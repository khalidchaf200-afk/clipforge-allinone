/* =====================================================================
   ClipForge — ALL-IN-ONE (React + Vite + FFmpeg.wasm + Firebase)
   مجاني بالكامل للجميع: بدون دفع، بدون رصيد، بدون خصم دقائق.
   كل الواجهة والمنطق والترجمات في هذا الملف الواحد.
   الأقسام: 1) الإعدادات  2) الترجمات  3) Firebase  4) محرك الفيديو
            5) السياق (Auth + اللغة)  6) الصفحات  7) التطبيق  8) التشغيل
   ===================================================================== */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, signOut, GoogleAuthProvider, signInWithPopup,
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import JSZip from 'jszip';

/* ============================ 1) الإعدادات ============================ */
const ADMIN_EMAIL = 'khalidchaf200@gmail.com';
const MIN_SECONDS = 5;
const MAX_SECONDS = 7200;         // 120 دقيقة (حدّ تقني لحماية ذاكرة المتصفح فقط)
const AUDIO_RATE = 48000;         // معدل عينات موحّد (التسجيل + التصدير)
const AUDIO_BITRATE = '192k';     // جودة AAC عند التصدير

const LANGS = { ar: 'العربية', en: 'English', fr: 'Français', es: 'Español' };

/* ============================ 2) الترجمات ============================ */
const DICT = {
  ar: {
    tagline: 'حوّل صورك وصوتك إلى فيديو جاهز لليوتيوب مباشرة من متصفحك.',
    f1: '✨ حركة Zoom/Pan تلقائية على الصور', f2: '🎙️ تسجيل صوتي مباشر أو رفع ملف',
    f3: '🔒 ملفاتك لا تغادر جهازك', f4: '🎁 مجاني بالكامل للجميع · بدون دفع وبدون حدود',
    login: 'تسجيل الدخول', signup: 'إنشاء حساب', reset: 'استعادة كلمة المرور',
    email: 'البريد الإلكتروني', password: 'كلمة المرور', enter: 'دخول', createAcc: 'إنشاء الحساب',
    sendLink: 'إرسال الرابط', haveAcc: 'لدي حساب', newAcc: 'حساب جديد', forgot: 'نسيت كلمة المرور؟',
    resetSent: 'تم إرسال رابط إعادة تعيين كلمة المرور.',
    googleBtn: 'تسجيل الدخول باستخدام Google', orSep: 'أو', e_popup: 'المتصفح منع نافذة Google المنبثقة. اسمح بالنوافذ المنبثقة لهذا الموقع وأعد المحاولة.',
    e_domain: 'نطاق هذا الموقع غير مصرّح به في Firebase (Authorized domains).', e_provider: 'طريقة تسجيل الدخول هذه غير مفعّلة في Firebase (Sign-in method).',
    e_apikey: 'مفتاح Firebase غير صالح أو إعدادات VITE_FIREBASE_* خاطئة.', errCode: 'رمز الخطأ',
    verifyTitle: '📧 أكّد بريدك الإلكتروني', verifyText: 'أرسلنا رابط تأكيد إلى {email}. افتح الرابط ثم اضغط الزر أدناه.',
    verifiedBtn: 'لقد أكدت بريدي', resend: 'إعادة الإرسال', resent: 'تم إرسال الرابط من جديد.', logout: 'خروج',
    tabEditor: 'المونتاج', tabAdmin: 'غرفة المدير',
    freeChip: '🎁 مجاني للجميع',
    footer: 'تتم معالجة ملفاتك داخل متصفحك فقط ولا يتم رفعها إلى أي خادم.',
    e_invalid: 'البريد الإلكتروني غير صالح.', e_notfound: 'لا يوجد حساب بهذا البريد.',
    e_cred: 'البريد أو كلمة المرور غير صحيحة.', e_exists: 'هذا البريد مسجّل مسبقاً.',
    e_weak: 'كلمة المرور ضعيفة (6 أحرف على الأقل).', e_many: 'محاولات كثيرة، حاول لاحقاً.',
    e_net: 'مشكلة في الاتصال بالإنترنت.', e_generic: 'حدث خطأ غير متوقع.',
    cfgTitle: '⚠️ إعدادات Firebase ناقصة', cfgText: 'أضف متغيرات VITE_FIREBASE_* (ملف .env محلياً أو Environment Variables على Vercel).',
    images: '1) الصور', pickImages: '📷 اضغط لاختيار صور متعددة', audio: '2) الصوت',
    uploadAudio: '🎵 رفع ملف صوتي', record: '🎙️ تسجيل مباشر', stop: '⏹ إيقاف', removeAudio: 'إزالة الصوت',
    noAudioDur: 'بدون صوت؟ حدّد مدة الفيديو (بالثواني)', produce: '3) الإنتاج', resolution: 'الدقة',
    duration: 'المدة', cost: 'التكلفة', free: 'مجاني 🎁',
    generate: '🚀 إنتاج الفيديو', generating: 'جارٍ الإنتاج...', errNoImages: 'أضف صورة واحدة على الأقل.',
    errDuration: 'المدة يجب أن تكون بين {min} ثوانٍ و{max} دقيقة.',
    errMic: 'لا يمكن الوصول إلى الميكروفون. تأكد من منح الإذن.', errAudio: 'تعذّر قراءة الملف الصوتي.',
    longWarn: '⚠️ الفيديوهات الطويلة تستهلك ذاكرة المتصفح؛ استخدم حاسوباً وأغلق التبويبات الأخرى واختر 360p.',
    loadingEngine: 'تحميل محرك المونتاج (أول مرة فقط)...', procImg: 'معالجة الصورة {i} من {n}...',
    merging: 'دمج المقاطع والصوت...', packaging: 'تجهيز الملف...', zipping: 'ضغط الملف في ZIP...',
    done: 'اكتمل الفيديو 🎉', downloadZip: '⬇️ تحميل ZIP ({size})', downloadMp4: '⬇️ تحميل MP4 ({size})',
    renderErr: 'حدث خطأ أثناء الإنتاج', renderHint: 'جرّب دقة أقل أو عدد صور أقل.',
    adminTitle: 'غرفة المدير', usersCount: 'عدد المستخدمين المسجّلين: {n}', refresh: 'تحديث',
    filterPh: 'ابحث بالبريد...', colEmail: 'البريد', colDate: 'تاريخ التسجيل', noUsers: 'لا يوجد مستخدمون.',
    permErr: 'خطأ في الصلاحيات: راجع قواعد Firestore.',
  },
  en: {
    tagline: 'Turn your images and voice into a YouTube-ready video, right in your browser.',
    f1: '✨ Automatic Zoom/Pan motion on images', f2: '🎙️ Record live or upload audio',
    f3: '🔒 Your files never leave your device', f4: '🎁 Completely free for everyone · no payment, no limits',
    login: 'Sign in', signup: 'Create account', reset: 'Reset password',
    email: 'Email', password: 'Password', enter: 'Sign in', createAcc: 'Create account',
    sendLink: 'Send link', haveAcc: 'I have an account', newAcc: 'New account', forgot: 'Forgot password?',
    resetSent: 'Password reset link sent.',
    googleBtn: 'Sign in with Google', orSep: 'or', e_popup: 'The browser blocked the Google popup. Allow popups for this site and try again.',
    e_domain: 'This site domain is not authorized in Firebase (Authorized domains).', e_provider: 'This sign-in method is not enabled in Firebase (Sign-in method).',
    e_apikey: 'Invalid Firebase API key or wrong VITE_FIREBASE_* settings.', errCode: 'Error code',
    verifyTitle: '📧 Confirm your email', verifyText: 'We sent a confirmation link to {email}. Open it, then press the button below.',
    verifiedBtn: 'I confirmed my email', resend: 'Resend', resent: 'Link sent again.', logout: 'Log out',
    tabEditor: 'Editor', tabAdmin: 'Admin room',
    freeChip: '🎁 Free for everyone',
    footer: 'Your files are processed in your browser only and are never uploaded.',
    e_invalid: 'Invalid email address.', e_notfound: 'No account with this email.',
    e_cred: 'Wrong email or password.', e_exists: 'This email is already registered.',
    e_weak: 'Weak password (min. 6 characters).', e_many: 'Too many attempts, try again later.',
    e_net: 'Network problem.', e_generic: 'Unexpected error.',
    cfgTitle: '⚠️ Firebase settings missing', cfgText: 'Add the VITE_FIREBASE_* variables (.env locally, Environment Variables on Vercel).',
    images: '1) Images', pickImages: '📷 Click to choose multiple images', audio: '2) Audio',
    uploadAudio: '🎵 Upload audio', record: '🎙️ Record live', stop: '⏹ Stop', removeAudio: 'Remove audio',
    noAudioDur: 'No audio? Set the video length (seconds)', produce: '3) Produce', resolution: 'Resolution',
    duration: 'Duration', cost: 'Cost', free: 'Free 🎁',
    generate: '🚀 Generate video', generating: 'Generating...', errNoImages: 'Add at least one image.',
    errDuration: 'Length must be between {min} seconds and {max} minutes.',
    errMic: 'Cannot access the microphone. Check the permission.', errAudio: 'Could not read the audio file.',
    longWarn: '⚠️ Long videos use a lot of browser memory: use a computer, close other tabs and pick 360p.',
    loadingEngine: 'Loading the editing engine (first time only)...', procImg: 'Processing image {i} of {n}...',
    merging: 'Merging clips and audio...', packaging: 'Preparing the file...', zipping: 'Zipping the file...',
    done: 'Video ready 🎉', downloadZip: '⬇️ Download ZIP ({size})', downloadMp4: '⬇️ Download MP4 ({size})',
    renderErr: 'Render error', renderHint: 'Try a lower resolution or fewer images.',
    adminTitle: 'Admin room', usersCount: 'Registered users: {n}', refresh: 'Refresh',
    filterPh: 'Search by email...', colEmail: 'Email', colDate: 'Signed up', noUsers: 'No users.',
    permErr: 'Permission error: check the Firestore rules.',
  },
  fr: {
    tagline: 'Transformez vos images et votre voix en vidéo prête pour YouTube, directement dans votre navigateur.',
    f1: '✨ Mouvement Zoom/Pan automatique sur les images', f2: '🎙️ Enregistrement direct ou import audio',
    f3: '🔒 Vos fichiers ne quittent jamais votre appareil', f4: '🎁 Entièrement gratuit pour tous · sans paiement, sans limites',
    login: 'Connexion', signup: 'Créer un compte', reset: 'Réinitialiser le mot de passe',
    email: 'E-mail', password: 'Mot de passe', enter: 'Se connecter', createAcc: 'Créer le compte',
    sendLink: 'Envoyer le lien', haveAcc: "J'ai un compte", newAcc: 'Nouveau compte', forgot: 'Mot de passe oublié ?',
    resetSent: 'Lien de réinitialisation envoyé.',
    googleBtn: 'Se connecter avec Google', orSep: 'ou', e_popup: 'Le navigateur a bloqué la fenêtre Google. Autorisez les pop-ups pour ce site et réessayez.',
    e_domain: "Le domaine de ce site n'est pas autorisé dans Firebase (Authorized domains).", e_provider: "Cette méthode de connexion n'est pas activée dans Firebase (Sign-in method).",
    e_apikey: 'Clé API Firebase invalide ou variables VITE_FIREBASE_* incorrectes.', errCode: "Code d'erreur",
    verifyTitle: '📧 Confirmez votre e-mail', verifyText: 'Nous avons envoyé un lien de confirmation à {email}. Ouvrez-le puis appuyez sur le bouton ci-dessous.',
    verifiedBtn: "J'ai confirmé mon e-mail", resend: 'Renvoyer', resent: 'Lien renvoyé.', logout: 'Déconnexion',
    tabEditor: 'Montage', tabAdmin: 'Espace admin',
    freeChip: '🎁 Gratuit pour tous',
    footer: "Vos fichiers sont traités uniquement dans votre navigateur et ne sont jamais envoyés.",
    e_invalid: 'Adresse e-mail invalide.', e_notfound: 'Aucun compte avec cet e-mail.',
    e_cred: 'E-mail ou mot de passe incorrect.', e_exists: 'Cet e-mail est déjà utilisé.',
    e_weak: 'Mot de passe trop faible (6 caractères minimum).', e_many: 'Trop de tentatives, réessayez plus tard.',
    e_net: 'Problème de connexion.', e_generic: 'Erreur inattendue.',
    cfgTitle: '⚠️ Configuration Firebase manquante', cfgText: "Ajoutez les variables VITE_FIREBASE_* (.env en local, Environment Variables sur Vercel).",
    images: '1) Images', pickImages: '📷 Cliquez pour choisir plusieurs images', audio: '2) Audio',
    uploadAudio: '🎵 Importer un audio', record: '🎙️ Enregistrer', stop: '⏹ Arrêter', removeAudio: "Retirer l'audio",
    noAudioDur: "Pas d'audio ? Définissez la durée (secondes)", produce: '3) Production', resolution: 'Résolution',
    duration: 'Durée', cost: 'Coût', free: 'Gratuit 🎁',
    generate: '🚀 Générer la vidéo', generating: 'Génération...', errNoImages: 'Ajoutez au moins une image.',
    errDuration: 'La durée doit être entre {min} secondes et {max} minutes.',
    errMic: "Impossible d'accéder au micro. Vérifiez l'autorisation.", errAudio: 'Impossible de lire le fichier audio.',
    longWarn: '⚠️ Les longues vidéos consomment beaucoup de mémoire : utilisez un ordinateur, fermez les autres onglets et choisissez 360p.',
    loadingEngine: 'Chargement du moteur de montage (première fois seulement)...', procImg: "Traitement de l'image {i} sur {n}...",
    merging: 'Assemblage des clips et de l\'audio...', packaging: 'Préparation du fichier...', zipping: 'Compression ZIP...',
    done: 'Vidéo prête 🎉', downloadZip: '⬇️ Télécharger le ZIP ({size})', downloadMp4: '⬇️ Télécharger le MP4 ({size})',
    renderErr: 'Erreur de rendu', renderHint: "Essayez une résolution plus basse ou moins d'images.",
    adminTitle: 'Espace admin', usersCount: 'Utilisateurs inscrits : {n}', refresh: 'Actualiser',
    filterPh: 'Rechercher par e-mail...', colEmail: 'E-mail', colDate: 'Inscription', noUsers: 'Aucun utilisateur.',
    permErr: 'Erreur de permissions : vérifiez les règles Firestore.',
  },
  es: {
    tagline: 'Convierte tus imágenes y tu voz en un video listo para YouTube, directamente en tu navegador.',
    f1: '✨ Movimiento Zoom/Pan automático en las imágenes', f2: '🎙️ Graba en directo o sube un audio',
    f3: '🔒 Tus archivos nunca salen de tu dispositivo', f4: '🎁 Totalmente gratis para todos · sin pagos, sin límites',
    login: 'Iniciar sesión', signup: 'Crear cuenta', reset: 'Restablecer contraseña',
    email: 'Correo electrónico', password: 'Contraseña', enter: 'Entrar', createAcc: 'Crear cuenta',
    sendLink: 'Enviar enlace', haveAcc: 'Ya tengo cuenta', newAcc: 'Cuenta nueva', forgot: '¿Olvidaste tu contraseña?',
    resetSent: 'Enlace de restablecimiento enviado.',
    googleBtn: 'Iniciar sesión con Google', orSep: 'o', e_popup: 'El navegador bloqueó la ventana de Google. Permite las ventanas emergentes para este sitio e inténtalo de nuevo.',
    e_domain: 'El dominio de este sitio no está autorizado en Firebase (Authorized domains).', e_provider: 'Este método de inicio de sesión no está activado en Firebase (Sign-in method).',
    e_apikey: 'Clave de API de Firebase no válida o variables VITE_FIREBASE_* incorrectas.', errCode: 'Código de error',
    verifyTitle: '📧 Confirma tu correo', verifyText: 'Enviamos un enlace de confirmación a {email}. Ábrelo y pulsa el botón de abajo.',
    verifiedBtn: 'Ya confirmé mi correo', resend: 'Reenviar', resent: 'Enlace reenviado.', logout: 'Salir',
    tabEditor: 'Editor', tabAdmin: 'Sala de admin',
    freeChip: '🎁 Gratis para todos',
    footer: 'Tus archivos se procesan solo en tu navegador y nunca se suben.',
    e_invalid: 'Correo electrónico no válido.', e_notfound: 'No existe una cuenta con este correo.',
    e_cred: 'Correo o contraseña incorrectos.', e_exists: 'Este correo ya está registrado.',
    e_weak: 'Contraseña débil (mínimo 6 caracteres).', e_many: 'Demasiados intentos, inténtalo más tarde.',
    e_net: 'Problema de conexión.', e_generic: 'Error inesperado.',
    cfgTitle: '⚠️ Falta la configuración de Firebase', cfgText: 'Añade las variables VITE_FIREBASE_* (.env en local, Environment Variables en Vercel).',
    images: '1) Imágenes', pickImages: '📷 Haz clic para elegir varias imágenes', audio: '2) Audio',
    uploadAudio: '🎵 Subir audio', record: '🎙️ Grabar en directo', stop: '⏹ Detener', removeAudio: 'Quitar audio',
    noAudioDur: '¿Sin audio? Define la duración (segundos)', produce: '3) Producción', resolution: 'Resolución',
    duration: 'Duración', cost: 'Coste', free: 'Gratis 🎁',
    generate: '🚀 Generar video', generating: 'Generando...', errNoImages: 'Añade al menos una imagen.',
    errDuration: 'La duración debe estar entre {min} segundos y {max} minutos.',
    errMic: 'No se puede acceder al micrófono. Revisa el permiso.', errAudio: 'No se pudo leer el archivo de audio.',
    longWarn: '⚠️ Los videos largos consumen mucha memoria del navegador: usa un ordenador, cierra otras pestañas y elige 360p.',
    loadingEngine: 'Cargando el motor de edición (solo la primera vez)...', procImg: 'Procesando imagen {i} de {n}...',
    merging: 'Uniendo clips y audio...', packaging: 'Preparando el archivo...', zipping: 'Comprimiendo en ZIP...',
    done: 'Video listo 🎉', downloadZip: '⬇️ Descargar ZIP ({size})', downloadMp4: '⬇️ Descargar MP4 ({size})',
    renderErr: 'Error de renderizado', renderHint: 'Prueba una resolución menor o menos imágenes.',
    adminTitle: 'Sala de admin', usersCount: 'Usuarios registrados: {n}', refresh: 'Actualizar',
    filterPh: 'Buscar por correo...', colEmail: 'Correo', colDate: 'Registro', noUsers: 'No hay usuarios.',
    permErr: 'Error de permisos: revisa las reglas de Firestore.',
  },
};

const detectLang = () => {
  try {
    const saved = localStorage.getItem('cf_lang');
    if (saved && DICT[saved]) return saved;
  } catch { /* التخزين غير متاح */ }
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return DICT[nav] ? nav : 'en';
};

/* ============================ 3) Firebase ============================ */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const CONFIGURED = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
const fbApp = CONFIGURED ? initializeApp(firebaseConfig) : null;
const auth = fbApp ? getAuth(fbApp) : null;
const db = fbApp ? getFirestore(fbApp) : null;

/* ============================ 4) محرك الفيديو ============================ */
/*
  إصلاح "failed to import ffmpeg-core.js":
  - نستخدم @ffmpeg/core الأحادي الخيط (وليس core-mt) → لا يحتاج SharedArrayBuffer
    ولا ترويسات COOP/COEP.
  - نستخدم نسخة ESM (dist/esm) وليس UMD: Vite يشغّل عامل ffmpeg كـ "module worker"،
    والعامل يستورد النواة بـ import() ويقرأ .default، وهذا موجود في ESM فقط.
  - toBlobURL يجلب الملفات (بـ CORS) ويحوّلها إلى روابط blob: محلية.
  - إن فشل مصدر (CDN) ننتقل تلقائياً إلى المصدر التالي.
*/
const CORE_VERSION = '0.12.6';
const CORE_BASES = [
  `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/esm`,
  `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/esm`,
];
const RESOLUTIONS = { '360p': { w: 640, h: 360 }, '480p': { w: 854, h: 480 }, '720p': { w: 1280, h: 720 } };
let ffmpegPromise = null;

async function loadFFmpegFrom(base) {
  const ff = new FFmpeg();
  await ff.load({
    coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  return ff;
}

function getFFmpeg() {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      let lastErr;
      for (const base of CORE_BASES) {
        try { return await loadFFmpegFrom(base); } catch (e) { lastErr = e; console.warn('ffmpeg load failed from', base, e); }
      }
      throw lastErr || new Error('ffmpeg load failed');
    })().catch((e) => { ffmpegPromise = null; throw e; });   // نسمح بإعادة المحاولة عند الفشل
  }
  return ffmpegPromise;
}

function getAudioDuration(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const a = new Audio();
    a.preload = 'metadata';
    a.src = url;
    const done = (d) => { URL.revokeObjectURL(url); resolve(d); };
    a.onloadedmetadata = () => {
      if (Number.isFinite(a.duration)) return done(a.duration);
      a.currentTime = 1e101; // حل مشكلة Infinity في تسجيلات webm
      a.ontimeupdate = () => { a.ontimeupdate = null; done(a.duration); };
    };
    a.onerror = () => { URL.revokeObjectURL(url); reject(new Error('audio')); };
  });
}

async function prepareImage(file, W, H) {
  const bmp = await createImageBitmap(file);
  const cw = W * 2, ch = H * 2;
  const canvas = document.createElement('canvas');
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext('2d');
  const scale = Math.max(cw / bmp.width, ch / bmp.height);
  const sw = cw / scale, sh = ch / scale;
  ctx.drawImage(bmp, (bmp.width - sw) / 2, (bmp.height - sh) / 2, sw, sh, 0, 0, cw, ch);
  if (bmp.close) bmp.close();
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.88));
  return new Uint8Array(await blob.arrayBuffer());
}

function zoompanFilter(i, frames, W, H, fps) {
  const mode = i % 3;
  const inc = (0.2 / Math.max(frames, 1)).toFixed(6);
  let z, x, y;
  if (mode === 0) { z = `min(zoom+${inc},1.2)`; x = 'iw/2-(iw/zoom/2)'; y = 'ih/2-(ih/zoom/2)'; }
  else if (mode === 1) { z = `if(eq(on,0),1.2,max(zoom-${inc},1.0))`; x = 'iw/2-(iw/zoom/2)'; y = 'ih/2-(ih/zoom/2)'; }
  else { z = '1.15'; x = `(iw-iw/zoom)*on/${frames}`; y = 'ih/2-(ih/zoom/2)'; }
  return `zoompan=z='${z}':x='${x}':y='${y}':d=${frames}:s=${W}x${H}:fps=${fps},format=yuv420p`;
}

// onStage(key, vars) يستقبل مفتاح ترجمة، وonProgress(0..1)
async function renderVideo({ images, audio, totalSeconds, resolution, onProgress, onStage }) {
  const { w: W, h: H } = RESOLUTIONS[resolution];
  const n = images.length;
  const fps = totalSeconds > 1800 ? 5 : totalSeconds > 600 ? 10 : 15;

  onStage('loadingEngine');
  const ff = await getFFmpeg();

  let currentFrames = 1;
  let segIndex = 0;
  const onLog = ({ message }) => {
    const m = /frame=\s*(\d+)/.exec(message);
    if (m) onProgress(((segIndex + Math.min(1, Number(m[1]) / currentFrames)) / n) * 0.92);
  };
  ff.on('log', onLog);

  const segs = [];
  try {
    const base = totalSeconds / n;
    const totalFrames = Math.round(totalSeconds * fps);
    let used = 0;
    for (let i = 0; i < n; i++) {
      segIndex = i;
      onStage('procImg', { i: i + 1, n });
      const frames = i === n - 1 ? Math.max(1, totalFrames - used) : Math.max(1, Math.round(base * fps));
      used += frames;
      currentFrames = frames;
      const imgName = `img${i}.jpg`;
      const segName = `seg${i}.mp4`;
      await ff.writeFile(imgName, await prepareImage(images[i], W, H));
      const code = await ff.exec([
        '-i', imgName, '-vf', zoompanFilter(i, frames, W, H, fps),
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '30', '-an', '-r', String(fps), segName,
      ]);
      await ff.deleteFile(imgName);
      if (code !== 0) throw new Error(`encode ${i + 1}`);
      segs.push(segName);
    }

    onStage('merging'); onProgress(0.93);
    await ff.writeFile('list.txt', new TextEncoder().encode(segs.map((s) => `file '${s}'`).join('\n')));
    const args = ['-f', 'concat', '-safe', '0', '-i', 'list.txt'];
    if (audio) {
      await ff.writeFile('audio.in', new Uint8Array(await audio.arrayBuffer()));
      // مسار صوت واحد فقط (map) لمنع أي تراكب، وبدون أي تضخيم (لا volume/gain).
      // aresample: معدل عينات موحّد 48kHz + إصلاح فجوات التوقيت في تسجيلات webm دون تغيير طول الصوت.
      // alimiter: سقف -0.9 → ~-0.9dBFS مع level=0 (يمنع التطبيع/التضخيم التلقائي) فلا يتجاوز الصوت 0dB.
      args.push(
        '-i', 'audio.in', '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy',
        '-af', `aresample=${AUDIO_RATE}:async=1,alimiter=limit=0.9:attack=5:release=50:level=0`,
        '-c:a', 'aac', '-b:a', AUDIO_BITRATE, '-ar', String(AUDIO_RATE),
        '-t', String(totalSeconds), '-movflags', '+faststart', 'out.mp4',
      );
    } else {
      args.push('-c', 'copy', '-movflags', '+faststart', 'out.mp4');
    }
    if ((await ff.exec(args)) !== 0) throw new Error('merge');

    for (const s of segs) { try { await ff.deleteFile(s); } catch { /* */ } }
    try { await ff.deleteFile('audio.in'); } catch { /* */ }
    try { await ff.deleteFile('list.txt'); } catch { /* */ }

    onStage('packaging'); onProgress(0.96);
    const data = await ff.readFile('out.mp4');
    try { await ff.deleteFile('out.mp4'); } catch { /* */ }
    const mp4Blob = new Blob([data.buffer], { type: 'video/mp4' });

    onStage('zipping');
    const zip = new JSZip();
    zip.file('video.mp4', mp4Blob);
    const zipBlob = await zip.generateAsync(
      { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 1 } },
      (meta) => onProgress(0.96 + (meta.percent / 100) * 0.04),
    );
    onProgress(1);
    return { mp4Blob, zipBlob };
  } finally {
    ff.off('log', onLog);
  }
}

/* ============================ 5) السياق ============================ */
const Ctx = createContext(null);
const useApp = () => useContext(Ctx);

const fmtTime = (s) => {
  s = Math.round(s);
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((v) => String(v).padStart(2, '0')).join(':');
};
const fmtSize = (b) => `${(b / 1048576).toFixed(1)} MB`;

function Provider({ children }) {
  const [lang, setLangState] = useState(detectLang);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(CONFIGURED);
  const [, setTick] = useState(0);

  // اتجاه الصفحة واللغة تلقائياً
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = 'ClipForge';
  }, [lang]);

  const setLang = (l) => {
    setLangState(l);
    try { localStorage.setItem('cf_lang', l); } catch { /* */ }
  };

  const t = useCallback((key, vars) => {
    let s = DICT[lang]?.[key] ?? DICT.en[key] ?? key;
    if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]));
    return s;
  }, [lang]);

  useEffect(() => {
    if (!CONFIGURED) return undefined;
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);
      if (!u) return;
      // سجلّ بسيط للمستخدمين (لغرفة المدير فقط). لا علاقة له بأي رصيد أو دفع.
      // الحقول تطابق قواعد Firestore الحالية، وأي فشل هنا لا يؤثر على عمل التطبيق.
      try {
        const ref = doc(db, 'users', u.uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          await setDoc(ref, {
            email: (u.email || '').toLowerCase(), balance: 2, unlimited: false,
            minutesUsed: 0, createdAt: serverTimestamp(),
          });
        }
      } catch (e) { console.warn('profile init skipped (لا يمنع الدخول)', e); }
    });
    return () => unsubAuth();
  }, []);

  const email = (user?.email || '').toLowerCase();
  const verified = Boolean(user?.emailVerified);
  // المدير: نفس الإيميل + إيميل مؤكَّد (قواعد Firestore تفرض الشرط نفسه في الخادم)
  const isAdmin = verified && email === ADMIN_EMAIL.toLowerCase();

  const refreshUser = useCallback(async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true);
    setUser(auth.currentUser);
    setTick((x) => x + 1);
  }, []);

  const api = {
    lang, setLang, t, user, loading, isAdmin, verified, refreshUser,
    signup: async (m, p) => {
      const c = await createUserWithEmailAndPassword(auth, m, p);
      // فشل إرسال رسالة التأكيد لا يجب أن يُظهر خطأ والحساب أُنشئ فعلاً؛ يمكن إعادة الإرسال من شاشة التأكيد
      try { await sendEmailVerification(c.user); } catch (e) { console.warn('verification email failed', e); }
    },
    loginGoogle: () => {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      return signInWithPopup(auth, provider);
    },
    login: (m, p) => signInWithEmailAndPassword(auth, m, p),
    resetPassword: (m) => sendPasswordResetEmail(auth, m),
    resendVerification: () => sendEmailVerification(auth.currentUser),
    logout: () => signOut(auth),
  };
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

/* ============================ 6) الصفحات ============================ */
function LangSwitch() {
  const { lang, setLang } = useApp();
  return (
    <select className="lang" value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Language">
      {Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </select>
  );
}

const authErrorKey = (code) => ({
  'auth/invalid-email': 'e_invalid', 'auth/user-not-found': 'e_notfound', 'auth/wrong-password': 'e_cred',
  'auth/invalid-credential': 'e_cred', 'auth/email-already-in-use': 'e_exists', 'auth/weak-password': 'e_weak',
  'auth/too-many-requests': 'e_many', 'auth/network-request-failed': 'e_net',
  'auth/popup-blocked': 'e_popup', 'auth/unauthorized-domain': 'e_domain',
  'auth/operation-not-allowed': 'e_provider', 'auth/configuration-not-found': 'e_provider',
  'auth/invalid-api-key': 'e_apikey', 'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'e_apikey',
}[code] || 'e_generic');

// يعرض الرسالة المفهومة + رمز الخطأ الحقيقي من Firebase (ولرسائل غير المعروفة: النص الأصلي كاملاً)
function describeError(ex, t) {
  console.error('[auth error]', ex);
  const code = ex?.code || '';
  const key = authErrorKey(code);
  let text = t(key);
  if (key === 'e_generic') text += ` ${ex?.message || String(ex)}`;
  if (code) text += ` — ${t('errCode')}: ${code}`;
  return text;
}

/* ---------- تسجيل الدخول ---------- */
function Login() {
  const { t, login, signup, resetPassword, loginGoogle } = useApp();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setInfo(''); setBusy(true);
    try {
      if (mode === 'login') await login(email.trim(), pass);
      else if (mode === 'signup') await signup(email.trim(), pass);
      else { await resetPassword(email.trim()); setInfo(t('resetSent')); }
    } catch (ex) { setErr(describeError(ex, t)); }
    setBusy(false);
  };

  const google = async () => {
    setErr(''); setInfo(''); setBusy(true);
    try { await loginGoogle(); } catch (ex) {
      // إغلاق النافذة من المستخدم ليس خطأً حقيقياً
      if (ex?.code !== 'auth/popup-closed-by-user' && ex?.code !== 'auth/cancelled-popup-request') setErr(describeError(ex, t));
    }
    setBusy(false);
  };

  return (
    <div className="center-screen">
      <div className="lang-corner"><LangSwitch /></div>
      <div className="hero">
        <h1>🎬 Clip<span>Forge</span></h1>
        <p className="lead">{t('tagline')}</p>
        <ul className="features">
          <li>{t('f1')}</li><li>{t('f2')}</li><li>{t('f3')}</li><li>{t('f4')}</li>
        </ul>
      </div>
      <form className="card narrow" onSubmit={submit}>
        <h2>{mode === 'login' ? t('login') : mode === 'signup' ? t('signup') : t('reset')}</h2>
        <label>{t('email')}
          <input type="email" dir="ltr" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {mode !== 'reset' && (
          <label>{t('password')}
            <input type="password" dir="ltr" required minLength={6} value={pass} onChange={(e) => setPass(e.target.value)} />
          </label>
        )}
        {err && <p className="err">{err}</p>}
        {info && <p className="ok">{info}</p>}
        <button className="btn primary block" disabled={busy}>
          {busy ? '...' : mode === 'login' ? t('enter') : mode === 'signup' ? t('createAcc') : t('sendLink')}
        </button>
        {mode !== 'reset' && (
          <>
            <div className="or"><span>{t('orSep')}</span></div>
            <button type="button" className="btn block google" disabled={busy} onClick={google}>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.1 5.5c4.2-3.8 6.7-9.5 6.7-16.9z"/>
                <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"/>
                <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.1-5.5c-2 1.4-4.6 2.3-8.8 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
              </svg>
              {t('googleBtn')}
            </button>
          </>
        )}
        <div className="links">
          {mode !== 'login' && <a onClick={() => setMode('login')}>{t('haveAcc')}</a>}
          {mode !== 'signup' && <a onClick={() => setMode('signup')}>{t('newAcc')}</a>}
          {mode !== 'reset' && <a onClick={() => setMode('reset')}>{t('forgot')}</a>}
        </div>
      </form>
    </div>
  );
}

/* ---------- المحرر ---------- */
function Editor() {
  const { t } = useApp();
  const [images, setImages] = useState([]);
  const [audio, setAudio] = useState(null);           // {blob, name, duration, url}
  const [manualSec, setManualSec] = useState(30);
  const [resolution, setResolution] = useState('480p');
  const [recording, setRecording] = useState(false);
  const [recSec, setRecSec] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(null);           // {key, vars}
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const recSecRef = useRef(0);
  const resultRef = useRef(null);

  useEffect(() => () => clearInterval(timerRef.current), []);

  const setAudioClean = (next) => {
    setAudio((prev) => { if (prev?.url) URL.revokeObjectURL(prev.url); return next; });
  };

  const addImages = (files) => {
    const list = [...files].filter((f) => f.type.startsWith('image/')).map((file) => ({
      id: crypto.randomUUID(), file, url: URL.createObjectURL(file),
    }));
    setImages((p) => [...p, ...list]);
  };
  const removeImage = (id) => setImages((p) => {
    const x = p.find((i) => i.id === id); if (x) URL.revokeObjectURL(x.url);
    return p.filter((i) => i.id !== id);
  });
  const move = (idx, dir) => setImages((p) => {
    const a = [...p]; const j = idx + dir;
    if (j < 0 || j >= a.length) return a;
    [a[idx], a[j]] = [a[j], a[idx]]; return a;
  });

  const onAudioFile = async (file) => {
    if (!file) return;
    setError('');
    try {
      const duration = await getAudioDuration(file);
      setAudioClean({ blob: file, name: file.name, duration, url: URL.createObjectURL(file) });
    } catch { setError(t('errAudio')); }
  };

  const startRec = async () => {
    setError('');
    try {
      // AGC وإلغاء الصدى يسبّبان "ضخّ" وتشويهاً في الصوت المسجّل؛ نعطّلهما ونطلب 48kHz.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: AUDIO_RATE, channelCount: 1,
          echoCancellation: false, autoGainControl: false, noiseSuppression: true,
        },
      });
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
        .find((m) => window.MediaRecorder?.isTypeSupported?.(m));
      const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 192000 });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        let duration;
        try { duration = await getAudioDuration(blob); } catch { duration = NaN; }
        if (!Number.isFinite(duration)) duration = recSecRef.current;
        setAudioClean({ blob, name: '🎙️', duration, url: URL.createObjectURL(blob) });
      };
      rec.start();
      recRef.current = rec;
      recSecRef.current = 0; setRecSec(0); setRecording(true);
      timerRef.current = setInterval(() => { recSecRef.current += 1; setRecSec(recSecRef.current); }, 1000);
    } catch { setError(t('errMic')); }
  };
  const stopRec = () => {
    clearInterval(timerRef.current);
    if (recRef.current) recRef.current.stop();
    setRecording(false);
  };

  const total = audio ? audio.duration : Number(manualSec) || 0;
  const durationOk = total >= MIN_SECONDS && total <= MAX_SECONDS;

  const generate = async () => {
    setError('');
    if (!images.length) return setError(t('errNoImages'));
    if (!durationOk) return setError(t('errDuration', { min: MIN_SECONDS, max: MAX_SECONDS / 60 }));
    if (resultRef.current) {
      URL.revokeObjectURL(resultRef.current.mp4Url); URL.revokeObjectURL(resultRef.current.zipUrl);
      resultRef.current = null; setResult(null);
    }
    setBusy(true); setProgress(0);
    try {
      const { mp4Blob, zipBlob } = await renderVideo({
        images: images.map((i) => i.file), audio: audio ? audio.blob : null, totalSeconds: total, resolution,
        onProgress: setProgress, onStage: (key, vars) => setStage({ key, vars }),
      });
      const res = {
        mp4Url: URL.createObjectURL(mp4Blob), zipUrl: URL.createObjectURL(zipBlob),
        mp4Size: mp4Blob.size, zipSize: zipBlob.size,
      };
      resultRef.current = res; setResult(res); setStage({ key: 'done' });
    } catch (e) {
      console.error(e);
      setError(`${t('renderErr')}: ${e.message || e}. ${t('renderHint')}`);
    }
    setBusy(false);
  };

  return (
    <div className="grid">
      <section className="card">
        <h3>{t('images')} <small>({images.length})</small></h3>
        <label className="drop">
          <input type="file" accept="image/*" multiple hidden onChange={(e) => { addImages(e.target.files); e.target.value = ''; }} />
          <span>{t('pickImages')}</span>
        </label>
        <div className="thumbs">
          {images.map((img, i) => (
            <div className="thumb" key={img.id}>
              <img src={img.url} alt="" />
              <span className="num">{i + 1}</span>
              <div className="tools">
                <button onClick={() => move(i, -1)}>◀</button>
                <button onClick={() => move(i, 1)}>▶</button>
                <button onClick={() => removeImage(img.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>{t('audio')}</h3>
        <div className="row">
          <label className="btn">{t('uploadAudio')}
            <input type="file" accept="audio/*" hidden onChange={(e) => { onAudioFile(e.target.files[0]); e.target.value = ''; }} />
          </label>
          {!recording
            ? <button className="btn" onClick={startRec}>{t('record')}</button>
            : <button className="btn danger" onClick={stopRec}>{t('stop')} ({fmtTime(recSec)})</button>}
          {audio && <button className="btn ghost" onClick={() => setAudioClean(null)}>{t('removeAudio')}</button>}
        </div>
        {audio ? (
          <div className="audio-box">
            <p>🎧 {audio.name} — <b>{fmtTime(audio.duration)}</b></p>
            <audio controls src={audio.url} />
          </div>
        ) : (
          <label className="field">{t('noAudioDur')}
            <input type="number" min={MIN_SECONDS} max={MAX_SECONDS} value={manualSec} onChange={(e) => setManualSec(e.target.value)} />
          </label>
        )}
      </section>

      <section className="card wide">
        <h3>{t('produce')}</h3>
        <div className="row spread">
          <label className="field">{t('resolution')}
            <select value={resolution} onChange={(e) => setResolution(e.target.value)}>
              {Object.entries(RESOLUTIONS).map(([k, v]) => <option key={k} value={k}>{k} ({v.w}×{v.h})</option>)}
            </select>
          </label>
          <div className="summary">
            <div>{t('duration')}: <b>{fmtTime(total)}</b></div>
            <div>{t('cost')}: <b>{t('free')}</b></div>
          </div>
        </div>
        {!durationOk && total > 0 && <p className="err">{t('errDuration', { min: MIN_SECONDS, max: MAX_SECONDS / 60 })}</p>}
        {total > 1800 && <p className="hint">{t('longWarn')}</p>}
        {error && <p className="err">{error}</p>}

        <button className="btn primary big" disabled={busy || !images.length} onClick={generate}>
          {busy ? t('generating') : t('generate')}
        </button>

        {(busy || result) && (
          <div className="progress-wrap">
            <div className="progress"><div className="bar" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
            <div className="progress-text"><span>{stage ? t(stage.key, stage.vars) : ''}</span><b>{Math.round(progress * 100)}%</b></div>
          </div>
        )}

        {result && (
          <div className="result">
            <video src={result.mp4Url} controls />
            <div className="row">
              <a className="btn primary" href={result.zipUrl} download="clipforge-video.zip">{t('downloadZip', { size: fmtSize(result.zipSize) })}</a>
              <a className="btn" href={result.mp4Url} download="clipforge-video.mp4">{t('downloadMp4', { size: fmtSize(result.mp4Size) })}</a>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------- غرفة المدير (للقراءة فقط: قائمة المستخدمين المسجّلين) ---------- */
function Admin() {
  const { t } = useApp();
  const [users, setUsers] = useState(null);
  const [filter, setFilter] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setErr(''); setBusy(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      rows.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setUsers(rows);
    } catch { setErr(t('permErr')); }
    setBusy(false);
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const shown = (users || []).filter((u) => (u.email || '').includes(filter.trim().toLowerCase()));

  return (
    <div className="grid">
      <section className="card wide">
        <h3>{t('adminTitle')}{users ? ` — ${t('usersCount', { n: users.length })}` : ''}</h3>
        <div className="row">
          <input dir="ltr" placeholder={t('filterPh')} value={filter} onChange={(e) => setFilter(e.target.value)} />
          <button className="btn" onClick={load} disabled={busy}>{busy ? '...' : t('refresh')}</button>
        </div>
        {err && <p className="err">{err}</p>}
        {users && (shown.length === 0
          ? <p className="hint">{t('noUsers')}</p>
          : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>{t('colEmail')}</th><th>{t('colDate')}</th></tr></thead>
                <tbody>
                  {shown.map((u) => (
                    <tr key={u.id}>
                      <td dir="ltr">{u.email}</td>
                      <td>{u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </section>
    </div>
  );
}

/* ============================ 7) التطبيق ============================ */
function Shell() {
  const { t, user, loading, verified, isAdmin, logout, resendVerification, refreshUser } = useApp();
  const [tab, setTab] = useState('editor');
  const [msg, setMsg] = useState('');

  if (!CONFIGURED) {
    return (
      <div className="center-screen"><div className="card narrow">
        <h2>{t('cfgTitle')}</h2><p>{t('cfgText')}</p><LangSwitch />
      </div></div>
    );
  }
  if (loading) return <div className="center-screen"><div className="spinner" /></div>;
  if (!user) return <Login />;

  if (!verified) {
    return (
      <div className="center-screen"><div className="card narrow">
        <h2>{t('verifyTitle')}</h2>
        <p>{t('verifyText', { email: user.email })}</p>
        {msg && <p className="ok">{msg}</p>}
        <div className="row">
          <button className="btn primary" onClick={refreshUser}>{t('verifiedBtn')}</button>
          <button className="btn" onClick={async () => { await resendVerification(); setMsg(t('resent')); }}>{t('resend')}</button>
          <button className="btn ghost" onClick={logout}>{t('logout')}</button>
        </div>
        <div style={{ marginTop: 14 }}><LangSwitch /></div>
      </div></div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">🎬 Clip<span>Forge</span></div>
        <nav>
          <button className={tab === 'editor' ? 'tab active' : 'tab'} onClick={() => setTab('editor')}>{t('tabEditor')}</button>
          {isAdmin && <button className={tab === 'admin' ? 'tab active' : 'tab'} onClick={() => setTab('admin')}>{t('tabAdmin')}</button>}
        </nav>
        <div className="user-box">
          <LangSwitch />
          <span className="chip vip">{t('freeChip')}</span>
          <span className="email" dir="ltr">{user.email}</span>
          <button className="btn ghost small" onClick={logout}>{t('logout')}</button>
        </div>
      </header>
      <main className="container">
        {tab === 'editor' && <Editor />}
        {tab === 'admin' && isAdmin && <Admin />}
      </main>
      <footer className="footer">{t('footer')}</footer>
    </div>
  );
}

const CSS = `
:root{--bg:#0b0b14;--card:#14141f;--card2:#1b1b2b;--line:#27273d;--text:#ececf6;--mut:#9a9ab5;--p1:#7c5cff;--p2:#ff4d8d;--ok:#2ecc8f;--err:#ff6b6b;--r:16px}
*{box-sizing:border-box}
html,body{margin:0;background:radial-gradient(1200px 600px at 80% -10%,#2a1b5c55,transparent),var(--bg);color:var(--text);font-family:'Cairo',system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif;min-height:100vh}
a{color:#a99bff;cursor:pointer;text-decoration:none}
h1,h2,h3{margin:.2em 0 .6em}
.center-screen{min-height:100vh;display:flex;flex-wrap:wrap;gap:40px;align-items:center;justify-content:center;padding:24px;position:relative}
.lang-corner{position:absolute;top:16px;inset-inline-end:16px}
.hero{max-width:440px}.hero h1{font-size:3rem;font-weight:800}
h1 span,.brand span{background:linear-gradient(90deg,var(--p1),var(--p2));-webkit-background-clip:text;background-clip:text;color:transparent}
.lead{color:var(--mut);font-size:1.15rem}.features{list-style:none;padding:0;line-height:2.1}
.card{background:linear-gradient(180deg,var(--card),var(--card2));border:1px solid var(--line);border-radius:var(--r);padding:22px;box-shadow:0 10px 40px #0006}
.card.narrow{width:100%;max-width:400px}
.topbar{display:flex;flex-wrap:wrap;gap:14px;align-items:center;justify-content:space-between;padding:14px 22px;border-bottom:1px solid var(--line);background:#0b0b14cc;backdrop-filter:blur(10px);position:sticky;top:0;z-index:5}
.brand{font-weight:800;font-size:1.4rem}
nav{display:flex;gap:6px;flex-wrap:wrap}
.tab{background:none;border:0;color:var(--mut);font:inherit;padding:8px 16px;border-radius:999px;cursor:pointer}
.tab.active{background:var(--card2);color:#fff;border:1px solid var(--line)}
.user-box{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.email{color:var(--mut);font-size:.85rem}
.chip{background:var(--card2);border:1px solid var(--line);padding:6px 14px;border-radius:999px;font-weight:600}
.chip.vip{background:linear-gradient(90deg,#ffb84d33,#ff4d8d33);border-color:#ffb84d88}
.container{max-width:1100px;margin:0 auto;padding:24px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}.wide{grid-column:1/-1}
@media(max-width:800px){.grid{grid-template-columns:1fr}.email{display:none}}
label{display:block;margin:12px 0;color:var(--mut);font-size:.92rem}
input,select{width:100%;margin-top:6px;background:#0d0d18;border:1px solid var(--line);color:var(--text);border-radius:10px;padding:11px 12px;font:inherit}
select.lang{width:auto;margin:0;padding:7px 10px}
input:focus,select:focus{outline:2px solid var(--p1)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;background:var(--card2);border:1px solid var(--line);color:var(--text);padding:10px 18px;border-radius:12px;font:inherit;font-weight:600;cursor:pointer;margin:0}
.btn:hover{border-color:var(--p1)}.btn:disabled{opacity:.5;cursor:not-allowed}
.btn.primary{background:linear-gradient(90deg,var(--p1),var(--p2));border:0;color:#fff}
.btn.danger{background:#ff4d4d22;border-color:#ff4d4d88}.btn.ghost{background:none}
.btn.small{padding:6px 12px;font-size:.85rem}.btn.big{padding:14px 28px;font-size:1.1rem;margin-top:14px}.btn.block{width:100%;margin-top:8px}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.row.spread{justify-content:space-between;align-items:flex-end}
.row input{flex:1;min-width:180px;margin-top:0}
.links{display:flex;gap:14px;justify-content:center;margin-top:14px;font-size:.9rem;flex-wrap:wrap}
.or{display:flex;align-items:center;gap:10px;color:var(--mut);margin:14px 0 6px;font-size:.85rem}.or::before,.or::after{content:'';flex:1;height:1px;background:var(--line)}
.btn.google{background:#fff;color:#1f1f1f;border-color:#dadce0}.btn.google:hover{border-color:#4285F4}
.err{color:var(--err);word-break:break-word}.ok{color:var(--ok)}.hint{color:var(--mut);font-size:.9rem}
.drop{border:2px dashed var(--line);border-radius:14px;padding:28px;text-align:center;cursor:pointer;color:var(--mut)}.drop:hover{border-color:var(--p1)}
.thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px;margin-top:14px;max-height:360px;overflow:auto}
.thumb{position:relative;border-radius:10px;overflow:hidden;aspect-ratio:16/10;border:1px solid var(--line)}
.thumb img{width:100%;height:100%;object-fit:cover}
.thumb .num{position:absolute;top:4px;inset-inline-end:4px;background:#000b;border-radius:6px;padding:0 7px;font-size:.8rem}
.thumb .tools{position:absolute;bottom:0;left:0;right:0;display:flex;justify-content:space-around;background:#000c;opacity:0;transition:.15s}
.thumb:hover .tools{opacity:1}.tools button{background:none;border:0;color:#fff;cursor:pointer;padding:5px}
@media(hover:none){.thumb .tools{opacity:1}}
.audio-box audio{width:100%;margin-top:6px}
.summary{display:grid;gap:4px;background:#0d0d18;border:1px solid var(--line);border-radius:12px;padding:12px 18px}
.progress-wrap{margin-top:18px}
.progress{height:14px;background:#0d0d18;border-radius:999px;overflow:hidden;border:1px solid var(--line)}
.bar{height:100%;background:linear-gradient(90deg,var(--p1),var(--p2));transition:width .3s}
.progress-text{display:flex;justify-content:space-between;margin-top:8px;color:var(--mut)}
.result video{width:100%;max-height:420px;border-radius:12px;background:#000;margin:18px 0 12px}
.tbl-wrap{margin-top:14px;max-height:480px;overflow:auto;border:1px solid var(--line);border-radius:12px}
.tbl{width:100%;border-collapse:collapse}
.tbl th,.tbl td{padding:10px 14px;text-align:start;border-bottom:1px solid var(--line)}
.tbl th{color:var(--mut);font-weight:600;background:#0d0d18;position:sticky;top:0}
.footer{text-align:center;color:var(--mut);padding:24px;font-size:.85rem}
.spinner{width:42px;height:42px;border:4px solid var(--line);border-top-color:var(--p1);border-radius:50%;animation:s 1s linear infinite}
@keyframes s{to{transform:rotate(360deg)}}
`;

export default function App() {
  return (
    <Provider>
      <style>{CSS}</style>
      <Shell />
    </Provider>
  );
}

/* ============================ 8) التشغيل ============================ */
createRoot(document.getElementById('root')).render(<App />);
