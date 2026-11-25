// Vercel Serverless Function: POST /api/webhook  (Lemon Squeezy -> Firestore credit)
import crypto from 'node:crypto';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// نحتاج الجسم الخام (raw) للتحقق من التوقيع
export const config = { api: { bodyParser: false } };

function getDb() {
  if (!getApps().length) {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    sa.private_key = String(sa.private_key).replace(/\\n/g, '\n');
    initializeApp({ credential: cert(sa) });
  }
  return getFirestore();
}

async function readRaw(req) {
  if (typeof req.body === 'string') return Buffer.from(req.body);
  if (Buffer.isBuffer(req.body)) return req.body;
  if (req.body && typeof req.body === 'object') return Buffer.from(JSON.stringify(req.body));
  const chunks = [];
  for await (const c of req) chunks.push(typeof c === 'string' ? Buffer.from(c) : c);
  return Buffer.concat(chunks);
}

function validSignature(raw, header, secret) {
  if (!header || !secret) return false;
  const digest = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(digest, 'utf8');
  const b = Buffer.from(String(header), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const raw = await readRaw(req);
    if (!validSignature(raw, req.headers['x-signature'], process.env.LEMON_WEBHOOK_SECRET)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const payload = JSON.parse(raw.toString('utf8'));
    const event = payload?.meta?.event_name;

    // نعالج فقط الطلبات المدفوعة الجديدة
    if (event !== 'order_created') return res.status(200).json({ ignored: event || 'unknown' });
    const attrs = payload?.data?.attributes || {};
    if (attrs.status !== 'paid') return res.status(200).json({ ignored: `status:${attrs.status}` });

    const uid = payload?.meta?.custom_data?.user_id;
    const orderId = String(payload?.data?.id || '');
    const variantId = String(attrs?.first_order_item?.variant_id || '');
    if (!uid || !orderId) return res.status(400).json({ error: 'Missing user_id or order id' });

    // عدد الدقائق يُحدَّد من الخادم حسب الـ variant (لا نثق بأي قيمة من المتصفح)
    const map = JSON.parse(process.env.LS_VARIANT_MINUTES || '{}');
    const minutes = Number(map[variantId]);
    if (!Number.isInteger(minutes) || minutes <= 0) {
      return res.status(422).json({ error: `Unknown variant ${variantId}` });
    }

    const db = getDb();
    const userRef = db.collection('users').doc(String(uid));
    const payRef = db.collection('payments').doc(orderId);

    const outcome = await db.runTransaction(async (tx) => {
      const [paySnap, userSnap] = await Promise.all([tx.get(payRef), tx.get(userRef)]);
      if (paySnap.exists) return 'duplicate';           // منع الإضافة المزدوجة عند إعادة الإرسال
      if (!userSnap.exists) return 'no_user';
      tx.set(payRef, {
        uid: String(uid), minutes, variantId, orderId,
        total: attrs.total ?? null, currency: attrs.currency || null,
        testMode: Boolean(attrs.test_mode), email: attrs.user_email || null,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.update(userRef, { balance: FieldValue.increment(minutes), updatedAt: FieldValue.serverTimestamp() });
      return 'credited';
    });

    if (outcome === 'no_user') return res.status(404).json({ error: 'User not found' }); // Lemon سيعيد المحاولة
    return res.status(200).json({ ok: true, outcome });
  } catch (err) {
    console.error('webhook error', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
