/* =====================================================================
   ClipForge — ALL-IN-ONE (React + Vite + FFmpeg.wasm + Firebase + Lemon Squeezy)
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
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot, runTransaction, serverTimestamp,
  collection, query, where, getDocs, writeBatch, increment,
} from 'firebase/firestore';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import JSZip from 'jszip';

/* ============================ 1) الإعدادات ============================ */
const ADMIN_EMAIL = 'khalidchaf200@gmail.com';
const TRIAL_MINUTES = 2;          // يجب أن يطابق firestore.rules (balance == 2)
const MIN_SECONDS = 5;
const MAX_SECONDS = 7200;         // 120 دقيقة

// Lemon Squeezy: اسم متجرك (subdomain) + الباقات.
// buyId = الـ UUID الموجود في رابط الشراء: https://STORE.lemonsqueezy.com/checkout/buy/<buyId>
// ملاحظة: عدد الدقائق الحقيقي يُحدَّد في الخادم عبر LS_VARIANT_MINUTES (variant id الرقمي).
const LS_STORE = 'YOUR-STORE';
const PACKS = [
  { minutes: 30,  usd: 4.99,  buyId: 'REPLACE-WITH-UUID-30' },
  { minutes: 100, usd: 14.99, buyId: 'REPLACE-WITH-UUID-100' },
  { minutes: 300, usd: 39.99, buyId: 'REPLACE-WITH-UUID-300' },
];

const LANGS = { ar: 'العربية', en: 'English', fr: 'Français', es: 'Español' };

/* ============================ 2) الترجمات ============================ */
const DICT = {
  ar: {
    tagline: 'حوّل صورك وصوتك إلى فيديو جاهز لليوتيوب مباشرة من متصفحك.',
    f1: '✨ حركة Zoom/Pan تلقائية على الصور', f2: '🎙️ تسجيل صوتي مباشر أو رفع ملف',
    f3: '🔒 ملفاتك لا تغادر جهازك', f4: '💳 ادفع حسب الدقائق · {trial} دقائق مجانية للتجربة',
    login: 'تسجيل الدخول', signup: 'إنشاء حساب', reset: 'استعادة كلمة المرور',
    email: 'البريد الإلكتروني', password: 'كلمة المرور', enter: 'دخول', createAcc: 'إنشاء الحساب',
    sendLink: 'إرسال الرابط', haveAcc: 'لدي حساب', newAcc: 'حساب جديد', forgot: 'نسيت كلمة المرور؟',
    resetSent: 'تم إرسال رابط إعادة تعيين كلمة المرور.',
    verifyTitle: '📧 أكّد بريدك الإلكتروني', verifyText: 'أرسلنا رابط تأكيد إلى {email}. افتح الرابط ثم اضغط الزر أدناه.',
    verifiedBtn: 'لقد أكدت بريدي', resend: 'إعادة الإرسال', resent: 'تم إرسال الرابط من جديد.', logout: 'خروج',
    tabEditor: 'المونتاج', tabBilling: 'شحن الرصيد', tabAdmin: 'غرفة المدير',
    balance: 'الرصيد: {n} دقيقة', vip: '👑 VIP غير محدود',
    footer: 'تتم معالجة ملفاتك داخل متصفحك فقط ولا يتم رفعها إلى أي خادم.',
    e_invalid: 'البريد الإلكتروني غير صالح.', e_notfound: 'لا يوجد حساب بهذا البريد.',
    e_cred: 'البريد أو كلمة المرور غير صحيحة.', e_exists: 'هذا البريد مسجّل مسبقاً.',
    e_weak: 'كلمة المرور ضعيفة (6 أحرف على الأقل).', e_many: 'محاولات كثيرة، حاول لاحقاً.',
    e_net: 'مشكلة في الاتصال بالإنترنت.', e_generic: 'حدث خطأ غير متوقع.',
    googleBtn: 'تسجيل الدخول بواسطة Google', orSep: 'أو',
    e_popup_closed: 'تم إغلاق نافذة Google قبل إكمال الدخول.', e_popup_blocked: 'المتصفح منع النافذة المنبثقة، اسمح بها ثم أعد المحاولة.',
    e_domain: 'نطاق الموقع غير مصرّح به في Firebase: أضفه في Authentication ← Settings ← Authorized domains.',
    e_provider: 'طريقة الدخول هذه غير مفعّلة في Firebase (Authentication ← Sign-in method).',
    e_diff: 'يوجد حساب بنفس البريد بطريقة دخول أخرى. ادخل بها أولاً.', profileErrTitle: 'تعذّر تحميل/إنشاء حسابك في قاعدة البيانات',
    cfgTitle: '⚠️ إعدادات Firebase ناقصة', cfgText: 'أضف متغيرات VITE_FIREBASE_* (ملف .env محلياً أو Environment Variables على Vercel).',
    images: '1) الصور', pickImages: '📷 اضغط لاختيار صور متعددة', audio: '2) الصوت',
    uploadAudio: '🎵 رفع ملف صوتي', record: '🎙️ تسجيل مباشر', stop: '⏹ إيقاف', removeAudio: 'إزالة الصوت',
    noAudioDur: 'بدون صوت؟ حدّد مدة الفيديو (بالثواني)', produce: '3) الإنتاج', resolution: 'الدقة',
    duration: 'المدة', billedMin: 'الدقائق المحتسبة', cost: 'التكلفة', free: 'مجاني (VIP) 👑',
    generate: '🚀 إنتاج الفيديو', generating: 'جارٍ الإنتاج...', errNoImages: 'أضف صورة واحدة على الأقل.',
    errDuration: 'المدة يجب أن تكون بين {min} ثوانٍ و{max} دقيقة.', errFunds: 'رصيدك غير كافٍ لهذه المدة.',
    errMic: 'لا يمكن الوصول إلى الميكروفون. تأكد من منح الإذن.', errAudio: 'تعذّر قراءة الملف الصوتي.',
    longWarn: '⚠️ الفيديوهات الطويلة تستهلك ذاكرة المتصفح؛ استخدم حاسوباً وأغلق التبويبات الأخرى واختر 360p.',
    lowBalance: 'رصيدك {n} دقيقة فقط.', buyMore: 'اشحن رصيدك',
    loadingEngine: 'تحميل محرك المونتاج (أول مرة فقط)...', procImg: 'معالجة الصورة {i} من {n}...',
    merging: 'دمج المقاطع والصوت...', packaging: 'تجهيز الملف...', zipping: 'ضغط الملف في ZIP...',
    done: 'اكتمل الفيديو 🎉', downloadZip: '⬇️ تحميل ZIP ({size})', downloadMp4: '⬇️ تحميل MP4 ({size})',
    renderErr: 'حدث خطأ أثناء الإنتاج', renderHint: 'جرّب دقة أقل أو عدد صور أقل.',
    yourBalance: 'رصيدك الحالي', unit: 'دقيقة', buyTitle: 'اختر الباقة', perMin: '≈ {p}$ للدقيقة',
    payMethods: 'ادفع بأمان عبر البطاقة أو Apple Pay أو Google Pay أو PayPal.', buyBtn: 'شراء',
    autoNote: 'تُضاف الدقائق تلقائياً بعد الدفع مباشرة (عادة في أقل من دقيقة). استخدم نفس الحساب المسجّل به الآن.',
    notConfigured: 'الدفع غير مُعدّ بعد (عدّل LS_STORE وروابط الباقات في App.jsx).',
    adminTitle: 'غرفة المدير', findUser: 'البحث عن مستخدم', search: 'بحث', userNotFound: 'لا يوجد مستخدم بهذا البريد.',
    addMin: 'إضافة دقائق', addBtn: 'إضافة', vipOn: 'جعله VIP', vipOff: 'إلغاء VIP', added: 'تمت إضافة {n} دقيقة.',
    balanceLine: 'الرصيد', used: 'المستهلك', yes: 'نعم', no: 'لا', permErr: 'خطأ في الصلاحيات: راجع قواعد Firestore.',
  },
  en: {
    tagline: 'Turn your images and voice into a YouTube-ready video, right in your browser.',
    f1: '✨ Automatic Zoom/Pan motion on images', f2: '🎙️ Record live or upload audio',
    f3: '🔒 Your files never leave your device', f4: '💳 Pay per minute · {trial} free minutes to start',
    login: 'Sign in', signup: 'Create account', reset: 'Reset password',
    email: 'Email', password: 'Password', enter: 'Sign in', createAcc: 'Create account',
    sendLink: 'Send link', haveAcc: 'I have an account', newAcc: 'New account', forgot: 'Forgot password?',
    resetSent: 'Password reset link sent.',
    verifyTitle: '📧 Confirm your email', verifyText: 'We sent a confirmation link to {email}. Open it, then press the button below.',
    verifiedBtn: 'I confirmed my email', resend: 'Resend', resent: 'Link sent again.', logout: 'Log out',
    tabEditor: 'Editor', tabBilling: 'Buy credits', tabAdmin: 'Admin room',
    balance: 'Balance: {n} min', vip: '👑 VIP unlimited',
    footer: 'Your files are processed in your browser only and are never uploaded.',
    e_invalid: 'Invalid email address.', e_notfound: 'No account with this email.',
    e_cred: 'Wrong email or password.', e_exists: 'This email is already registered.',
    e_weak: 'Weak password (min. 6 characters).', e_many: 'Too many attempts, try again later.',
    e_net: 'Network problem.', e_generic: 'Unexpected error.',
    googleBtn: 'Continue with Google', orSep: 'or',
    e_popup_closed: 'The Google window was closed before sign-in finished.', e_popup_blocked: 'The browser blocked the popup. Allow popups and try again.',
    e_domain: 'This site domain is not authorized in Firebase: add it under Authentication → Settings → Authorized domains.',
    e_provider: 'This sign-in method is not enabled in Firebase (Authentication → Sign-in method).',
    e_diff: 'An account with this email exists with another sign-in method. Use that one first.', profileErrTitle: 'Could not load/create your account in the database',
    cfgTitle: '⚠️ Firebase settings missing', cfgText: 'Add the VITE_FIREBASE_* variables (.env locally, Environment Variables on Vercel).',
    images: '1) Images', pickImages: '📷 Click to choose multiple images', audio: '2) Audio',
    uploadAudio: '🎵 Upload audio', record: '🎙️ Record live', stop: '⏹ Stop', removeAudio: 'Remove audio',
    noAudioDur: 'No audio? Set the video length (seconds)', produce: '3) Produce', resolution: 'Resolution',
    duration: 'Duration', billedMin: 'Billed minutes', cost: 'Cost', free: 'Free (VIP) 👑',
    generate: '🚀 Generate video', generating: 'Generating...', errNoImages: 'Add at least one image.',
    errDuration: 'Length must be between {min} seconds and {max} minutes.', errFunds: 'Not enough credit for this length.',
    errMic: 'Cannot access the microphone. Check the permission.', errAudio: 'Could not read the audio file.',
    longWarn: '⚠️ Long videos use a lot of browser memory: use a computer, close other tabs and pick 360p.',
    lowBalance: 'You only have {n} min.', buyMore: 'Buy credits',
    loadingEngine: 'Loading the editing engine (first time only)...', procImg: 'Processing image {i} of {n}...',
    merging: 'Merging clips and audio...', packaging: 'Preparing the file...', zipping: 'Zipping the file...',
    done: 'Video ready 🎉', downloadZip: '⬇️ Download ZIP ({size})', downloadMp4: '⬇️ Download MP4 ({size})',
    renderErr: 'Render error', renderHint: 'Try a lower resolution or fewer images.',
    yourBalance: 'Your balance', unit: 'min', buyTitle: 'Choose a pack', perMin: '≈ ${p} per minute',
    payMethods: 'Pay securely by card, Apple Pay, Google Pay or PayPal.', buyBtn: 'Buy',
    autoNote: 'Minutes are added automatically right after payment (usually within a minute). Use the account you are signed in with now.',
    notConfigured: 'Payments are not configured yet (set LS_STORE and the pack links in App.jsx).',
    adminTitle: 'Admin room', findUser: 'Find a user', search: 'Search', userNotFound: 'No user with this email.',
    addMin: 'Add minutes', addBtn: 'Add', vipOn: 'Make VIP', vipOff: 'Remove VIP', added: '{n} minutes added.',
    balanceLine: 'Balance', used: 'Used', yes: 'Yes', no: 'No', permErr: 'Permission error: check the Firestore rules.',
  },
  fr: {
    tagline: 'Transformez vos images et votre voix en vidéo prête pour YouTube, directement dans votre navigateur.',
    f1: '✨ Mouvement Zoom/Pan automatique sur les images', f2: '🎙️ Enregistrement direct ou import audio',
    f3: '🔒 Vos fichiers ne quittent jamais votre appareil', f4: '💳 Payez à la minute · {trial} minutes offertes pour commencer',
    login: 'Connexion', signup: 'Créer un compte', reset: 'Réinitialiser le mot de passe',
    email: 'E-mail', password: 'Mot de passe', enter: 'Se connecter', createAcc: 'Créer le compte',
    sendLink: 'Envoyer le lien', haveAcc: "J'ai un compte", newAcc: 'Nouveau compte', forgot: 'Mot de passe oublié ?',
    resetSent: 'Lien de réinitialisation envoyé.',
    verifyTitle: '📧 Confirmez votre e-mail', verifyText: 'Nous avons envoyé un lien de confirmation à {email}. Ouvrez-le puis appuyez sur le bouton ci-dessous.',
    verifiedBtn: "J'ai confirmé mon e-mail", resend: 'Renvoyer', resent: 'Lien renvoyé.', logout: 'Déconnexion',
    tabEditor: 'Montage', tabBilling: 'Recharger', tabAdmin: 'Espace admin',
    balance: 'Solde : {n} min', vip: '👑 VIP illimité',
    footer: "Vos fichiers sont traités uniquement dans votre navigateur et ne sont jamais envoyés.",
    e_invalid: 'Adresse e-mail invalide.', e_notfound: 'Aucun compte avec cet e-mail.',
    e_cred: 'E-mail ou mot de passe incorrect.', e_exists: 'Cet e-mail est déjà utilisé.',
    e_weak: 'Mot de passe trop faible (6 caractères minimum).', e_many: 'Trop de tentatives, réessayez plus tard.',
    e_net: 'Problème de connexion.', e_generic: 'Erreur inattendue.',
    googleBtn: 'Continuer avec Google', orSep: 'ou',
    e_popup_closed: 'La fenêtre Google a été fermée avant la fin de la connexion.', e_popup_blocked: 'Le navigateur a bloqué la fenêtre. Autorisez les popups puis réessayez.',
    e_domain: "Le domaine du site n'est pas autorisé dans Firebase : ajoutez-le dans Authentication → Settings → Authorized domains.",
    e_provider: "Cette méthode de connexion n'est pas activée dans Firebase (Authentication → Sign-in method).",
    e_diff: 'Un compte avec cet e-mail existe avec une autre méthode de connexion. Utilisez-la d\'abord.', profileErrTitle: 'Impossible de charger/créer votre compte dans la base de données',
    cfgTitle: '⚠️ Configuration Firebase manquante', cfgText: "Ajoutez les variables VITE_FIREBASE_* (.env en local, Environment Variables sur Vercel).",
    images: '1) Images', pickImages: '📷 Cliquez pour choisir plusieurs images', audio: '2) Audio',
    uploadAudio: '🎵 Importer un audio', record: '🎙️ Enregistrer', stop: '⏹ Arrêter', removeAudio: "Retirer l'audio",
    noAudioDur: "Pas d'audio ? Définissez la durée (secondes)", produce: '3) Production', resolution: 'Résolution',
    duration: 'Durée', billedMin: 'Minutes facturées', cost: 'Coût', free: 'Gratuit (VIP) 👑',
    generate: '🚀 Générer la vidéo', generating: 'Génération...', errNoImages: 'Ajoutez au moins une image.',
    errDuration: 'La durée doit être entre {min} secondes et {max} minutes.', errFunds: 'Crédit insuffisant pour cette durée.',
    errMic: "Impossible d'accéder au micro. Vérifiez l'autorisation.", errAudio: 'Impossible de lire le fichier audio.',
    longWarn: '⚠️ Les longues vidéos consomment beaucoup de mémoire : utilisez un ordinateur, fermez les autres onglets et choisissez 360p.',
    lowBalance: 'Il ne vous reste que {n} min.', buyMore: 'Recharger',
    loadingEngine: 'Chargement du moteur de montage (première fois seulement)...', procImg: "Traitement de l'image {i} sur {n}...",
    merging: 'Assemblage des clips et de l\'audio...', packaging: 'Préparation du fichier...', zipping: 'Compression ZIP...',
    done: 'Vidéo prête 🎉', downloadZip: '⬇️ Télécharger le ZIP ({size})', downloadMp4: '⬇️ Télécharger le MP4 ({size})',
    renderErr: 'Erreur de rendu', renderHint: "Essayez une résolution plus basse ou moins d'images.",
    yourBalance: 'Votre solde', unit: 'min', buyTitle: 'Choisissez un pack', perMin: '≈ {p} $ la minute',
    payMethods: 'Payez en toute sécurité par carte, Apple Pay, Google Pay ou PayPal.', buyBtn: 'Acheter',
    autoNote: "Les minutes sont ajoutées automatiquement juste après le paiement (en général sous une minute). Utilisez le compte connecté actuellement.",
    notConfigured: "Le paiement n'est pas encore configuré (modifiez LS_STORE et les liens des packs dans App.jsx).",
    adminTitle: 'Espace admin', findUser: 'Chercher un utilisateur', search: 'Chercher', userNotFound: 'Aucun utilisateur avec cet e-mail.',
    addMin: 'Ajouter des minutes', addBtn: 'Ajouter', vipOn: 'Passer VIP', vipOff: 'Retirer VIP', added: '{n} minutes ajoutées.',
    balanceLine: 'Solde', used: 'Utilisé', yes: 'Oui', no: 'Non', permErr: 'Erreur de permissions : vérifiez les règles Firestore.',
  },
  es: {
    tagline: 'Convierte tus imágenes y tu voz en un video listo para YouTube, directamente en tu navegador.',
    f1: '✨ Movimiento Zoom/Pan automático en las imágenes', f2: '🎙️ Graba en directo o sube un audio',
    f3: '🔒 Tus archivos nunca salen de tu dispositivo', f4: '💳 Paga por minuto · {trial} minutos gratis para empezar',
    login: 'Iniciar sesión', signup: 'Crear cuenta', reset: 'Restablecer contraseña',
    email: 'Correo electrónico', password: 'Contraseña', enter: 'Entrar', createAcc: 'Crear cuenta',
    sendLink: 'Enviar enlace', haveAcc: 'Ya tengo cuenta', newAcc: 'Cuenta nueva', forgot: '¿Olvidaste tu contraseña?',
    resetSent: 'Enlace de restablecimiento enviado.',
    verifyTitle: '📧 Confirma tu correo', verifyText: 'Enviamos un enlace de confirmación a {email}. Ábrelo y pulsa el botón de abajo.',
    verifiedBtn: 'Ya confirmé mi correo', resend: 'Reenviar', resent: 'Enlace reenviado.', logout: 'Salir',
    tabEditor: 'Editor', tabBilling: 'Comprar crédito', tabAdmin: 'Sala de admin',
    balance: 'Saldo: {n} min', vip: '👑 VIP ilimitado',
    footer: 'Tus archivos se procesan solo en tu navegador y nunca se suben.',
    e_invalid: 'Correo electrónico no válido.', e_notfound: 'No existe una cuenta con este correo.',
    e_cred: 'Correo o contraseña incorrectos.', e_exists: 'Este correo ya está registrado.',
    e_weak: 'Contraseña débil (mínimo 6 caracteres).', e_many: 'Demasiados intentos, inténtalo más tarde.',
    e_net: 'Problema de conexión.', e_generic: 'Error inesperado.',
    googleBtn: 'Continuar con Google', orSep: 'o',
    e_popup_closed: 'Se cerró la ventana de Google antes de terminar el inicio de sesión.', e_popup_blocked: 'El navegador bloqueó la ventana emergente. Permítela e inténtalo de nuevo.',
    e_domain: 'El dominio del sitio no está autorizado en Firebase: añádelo en Authentication → Settings → Authorized domains.',
    e_provider: 'Este método de inicio de sesión no está activado en Firebase (Authentication → Sign-in method).',
    e_diff: 'Existe una cuenta con este correo con otro método de acceso. Usa ese primero.', profileErrTitle: 'No se pudo cargar/crear tu cuenta en la base de datos',
    cfgTitle: '⚠️ Falta la configuración de Firebase', cfgText: 'Añade las variables VITE_FIREBASE_* (.env en local, Environment Variables en Vercel).',
    images: '1) Imágenes', pickImages: '📷 Haz clic para elegir varias imágenes', audio: '2) Audio',
    uploadAudio: '🎵 Subir audio', record: '🎙️ Grabar en directo', stop: '⏹ Detener', removeAudio: 'Quitar audio',
    noAudioDur: '¿Sin audio? Define la duración (segundos)', produce: '3) Producción', resolution: 'Resolución',
    duration: 'Duración', billedMin: 'Minutos facturados', cost: 'Coste', free: 'Gratis (VIP) 👑',
    generate: '🚀 Generar video', generating: 'Generando...', errNoImages: 'Añade al menos una imagen.',
    errDuration: 'La duración debe estar entre {min} segundos y {max} minutos.', errFunds: 'Crédito insuficiente para esta duración.',
    errMic: 'No se puede acceder al micrófono. Revisa el permiso.', errAudio: 'No se pudo leer el archivo de audio.',
    longWarn: '⚠️ Los videos largos consumen mucha memoria del navegador: usa un ordenador, cierra otras pestañas y elige 360p.',
    lowBalance: 'Solo tienes {n} min.', buyMore: 'Comprar crédito',
    loadingEngine: 'Cargando el motor de edición (solo la primera vez)...', procImg: 'Procesando imagen {i} de {n}...',
    merging: 'Uniendo clips y audio...', packaging: 'Preparando el archivo...', zipping: 'Comprimiendo en ZIP...',
    done: 'Video listo 🎉', downloadZip: '⬇️ Descargar ZIP ({size})', downloadMp4: '⬇️ Descargar MP4 ({size})',
    renderErr: 'Error de renderizado', renderHint: 'Prueba una resolución menor o menos imágenes.',
    yourBalance: 'Tu saldo', unit: 'min', buyTitle: 'Elige un paquete', perMin: '≈ ${p} por minuto',
    payMethods: 'Paga de forma segura con tarjeta, Apple Pay, Google Pay o PayPal.', buyBtn: 'Comprar',
    autoNote: 'Los minutos se añaden automáticamente justo después del pago (normalmente en menos de un minuto). Usa la cuenta con la que has iniciado sesión.',
    notConfigured: 'El pago aún no está configurado (edita LS_STORE y los enlaces de los paquetes en App.jsx).',
    adminTitle: 'Sala de admin', findUser: 'Buscar usuario', search: 'Buscar', userNotFound: 'No hay ningún usuario con este correo.',
    addMin: 'Añadir minutos', addBtn: 'Añadir', vipOn: 'Hacer VIP', vipOff: 'Quitar VIP', added: '{n} minutos añadidos.',
    balanceLine: 'Saldo', used: 'Usado', yes: 'Sí', no: 'No', permErr: 'Error de permisos: revisa las reglas de Firestore.',
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
const CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
const RESOLUTIONS = { '360p': { w: 640, h: 360 }, '480p': { w: 854, h: 480 }, '720p': { w: 1280, h: 720 } };
let ffmpegInstance = null;

async function getFFmpeg() {
  if (ffmpegInstance) return ffmpegInstance;
  const ff = new FFmpeg();
  await ff.load({
    coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  ffmpegInstance = ff;
  return ff;
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
      args.push('-i', 'audio.in', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '96k', '-t', String(totalSeconds), '-movflags', '+faststart', 'out.mp4');
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
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(CONFIGURED);
  const [profileErr, setProfileErr] = useState('');
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
    let unsubProfile = null;
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (unsubProfile) { unsubProfile(); unsubProfile = null; }
      setUser(u); setProfile(null); setProfileErr('');
      if (!u) { setLoading(false); return; }
      const ref = doc(db, 'users', u.uid);
      try {
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          await setDoc(ref, {
            email: (u.email || '').toLowerCase(), balance: TRIAL_MINUTES, unlimited: false,
            minutesUsed: 0, createdAt: serverTimestamp(),
          });
        }
      } catch (e) { console.error('profile init', e); setProfileErr(`${e.code || ''} ${e.message || e}`.trim()); }
      unsubProfile = onSnapshot(ref, (s) => { setProfile(s.data() || null); setLoading(false); },
        (e) => { console.error('profile read', e); setProfileErr(`${e.code || ''} ${e.message || e}`.trim()); setLoading(false); });
    });
    return () => { unsubAuth(); if (unsubProfile) unsubProfile(); };
  }, []);

  const email = (user?.email || '').toLowerCase();
  const verified = Boolean(user?.emailVerified);
  // المدير: نفس الإيميل + إيميل مؤكَّد (قواعد Firestore تفرض الشرط نفسه في الخادم)
  const isAdmin = verified && email === ADMIN_EMAIL.toLowerCase();
  const unlimited = isAdmin || profile?.unlimited === true;
  const balance = profile?.balance ?? 0;

  const refreshUser = useCallback(async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true);
    setUser(auth.currentUser);
    setTick((x) => x + 1);
  }, []);

  const api = {
    lang, setLang, t, user, profile, profileErr, loading, isAdmin, unlimited, balance, verified, refreshUser,
    signup: async (m, p) => { const c = await createUserWithEmailAndPassword(auth, m, p); await sendEmailVerification(c.user); },
    login: (m, p) => signInWithEmailAndPassword(auth, m, p),
    // Google: نفس onAuthStateChanged ينشئ مستند users/{uid} برصيد التجربة عند أول دخول
    loginGoogle: () => {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      return signInWithPopup(auth, provider);
    },
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

const AUTH_ERRORS = {
  'auth/invalid-email': 'e_invalid', 'auth/user-not-found': 'e_notfound', 'auth/wrong-password': 'e_cred',
  'auth/invalid-credential': 'e_cred', 'auth/email-already-in-use': 'e_exists', 'auth/weak-password': 'e_weak',
  'auth/too-many-requests': 'e_many', 'auth/network-request-failed': 'e_net',
  'auth/popup-closed-by-user': 'e_popup_closed', 'auth/cancelled-popup-request': 'e_popup_closed',
  'auth/popup-blocked': 'e_popup_blocked', 'auth/unauthorized-domain': 'e_domain',
  'auth/operation-not-allowed': 'e_provider', 'auth/account-exists-with-different-credential': 'e_diff',
};

// رسالة مفهومة + الكود الحقيقي دائماً؛ وللأخطاء غير المعروفة نعرض رسالة Firebase الأصلية كما هي
function errorText(t, ex) {
  const code = ex?.code || '';
  const key = AUTH_ERRORS[code];
  if (key) return `${t(key)} (${code})`;
  return ex?.message || code || String(ex);
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
    } catch (ex) { console.error('auth', ex); setErr(errorText(t, ex)); }
    setBusy(false);
  };

  const googleSignIn = async () => {
    setErr(''); setInfo(''); setBusy(true);
    try { await loginGoogle(); } catch (ex) { console.error('google auth', ex); setErr(errorText(t, ex)); }
    setBusy(false);
  };

  return (
    <div className="center-screen">
      <div className="lang-corner"><LangSwitch /></div>
      <div className="hero">
        <h1>🎬 Clip<span>Forge</span></h1>
        <p className="lead">{t('tagline')}</p>
        <ul className="features">
          <li>{t('f1')}</li><li>{t('f2')}</li><li>{t('f3')}</li><li>{t('f4', { trial: TRIAL_MINUTES })}</li>
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
            <div className="sep"><span>{t('orSep')}</span></div>
            <button type="button" className="btn google block" disabled={busy} onClick={googleSignIn}>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
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
function Editor({ goBilling }) {
  const { t, user, unlimited, balance } = useApp();
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
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
  const minutes = Math.ceil(total / 60);
  const durationOk = total >= MIN_SECONDS && total <= MAX_SECONDS;
  const hasFunds = unlimited || balance >= minutes;

  const generate = async () => {
    setError('');
    if (!images.length) return setError(t('errNoImages'));
    if (!durationOk) return setError(t('errDuration', { min: MIN_SECONDS, max: MAX_SECONDS / 60 }));
    if (!hasFunds) return setError(t('errFunds'));
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
      if (!unlimited) {
        const ref = doc(db, 'users', user.uid);
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(ref);
          const d = snap.data();
          tx.update(ref, {
            balance: Math.max(0, d.balance - minutes),
            minutesUsed: (d.minutesUsed || 0) + minutes,
            updatedAt: serverTimestamp(),
          });
        });
      }
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
            <div>{t('billedMin')}: <b>{minutes}</b></div>
            <div>{t('cost')}: <b>{unlimited ? t('free') : `${minutes} ${t('unit')}`}</b></div>
          </div>
        </div>
        {!durationOk && total > 0 && <p className="err">{t('errDuration', { min: MIN_SECONDS, max: MAX_SECONDS / 60 })}</p>}
        {!hasFunds && durationOk && <p className="err">{t('lowBalance', { n: balance })} <a onClick={goBilling}>{t('buyMore')}</a></p>}
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

/* ---------- شحن الرصيد (Lemon Squeezy, USD) ---------- */
function Billing() {
  const { t, user, balance, unlimited } = useApp();
  const configured = !LS_STORE.includes('YOUR') && PACKS.every((p) => !p.buyId.includes('REPLACE'));

  const checkoutUrl = (p) => {
    const u = new URL(`https://${LS_STORE}.lemonsqueezy.com/checkout/buy/${p.buyId}`);
    u.searchParams.set('checkout[email]', user.email || '');
    u.searchParams.set('checkout[custom][user_id]', user.uid);   // يعود إلى الـ webhook
    return u.toString();
  };

  return (
    <div className="grid">
      <section className="card">
        <h3>{t('yourBalance')}</h3>
        <div className="big-number">{unlimited ? '∞' : balance}<small> {t('unit')}</small></div>
        <p className="hint">{t('payMethods')}</p>
        <p className="hint">{t('autoNote')}</p>
      </section>
      <section className="card">
        <h3>{t('buyTitle')}</h3>
        {!configured && <p className="err">{t('notConfigured')}</p>}
        <div className="packs">
          {PACKS.map((p) => (
            <div className="pack" key={p.minutes}>
              <b>{p.minutes} {t('unit')}</b>
              <strong className="price">${p.usd.toFixed(2)}</strong>
              <span className="hint">{t('perMin', { p: (p.usd / p.minutes).toFixed(3) })}</span>
              {configured
                ? <a className="btn primary small" href={checkoutUrl(p)} target="_blank" rel="noopener noreferrer">{t('buyBtn')}</a>
                : <button className="btn small" disabled>{t('buyBtn')}</button>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ---------- غرفة المدير ---------- */
function Admin() {
  const { t } = useApp();
  const [search, setSearch] = useState('');
  const [found, setFound] = useState(null);
  const [add, setAdd] = useState(10);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const find = async () => {
    setErr(''); setMsg(''); setFound(null);
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('email', '==', search.trim().toLowerCase())));
      if (snap.empty) return setErr(t('userNotFound'));
      setFound({ id: snap.docs[0].id, ...snap.docs[0].data() });
    } catch (e) { console.error(e); setErr(`${t('permErr')} [${e.code || e.message}]`); }
  };

  const addBalance = async () => {
    const n = Math.floor(Number(add));
    if (!n || !found) return;
    setErr(''); setMsg('');
    try {
      const b = writeBatch(db);
      b.update(doc(db, 'users', found.id), { balance: increment(n), updatedAt: serverTimestamp() });
      await b.commit();
      setFound({ ...found, balance: (found.balance || 0) + n });
      setMsg(t('added', { n }));
    } catch (e) { console.error(e); setErr(`${t('permErr')} [${e.code || e.message}]`); }
  };

  const toggleVip = async () => {
    setErr(''); setMsg('');
    try {
      const b = writeBatch(db);
      b.update(doc(db, 'users', found.id), { unlimited: !found.unlimited, updatedAt: serverTimestamp() });
      await b.commit();
      setFound({ ...found, unlimited: !found.unlimited });
    } catch (e) { console.error(e); setErr(`${t('permErr')} [${e.code || e.message}]`); }
  };

  return (
    <div className="grid">
      <section className="card wide">
        <h3>{t('adminTitle')} — {t('findUser')}</h3>
        <div className="row">
          <input dir="ltr" placeholder="user@email.com" value={search}
            onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && find()} />
          <button className="btn" onClick={find}>{t('search')}</button>
        </div>
        {err && <p className="err">{err}</p>}
        {msg && <p className="ok">{msg}</p>}
        {found && (
          <div className="found">
            <p dir="ltr"><b>{found.email}</b></p>
            <p>{t('balanceLine')}: <b>{found.balance}</b> {t('unit')} — VIP: <b>{found.unlimited ? t('yes') : t('no')}</b> — {t('used')}: {found.minutesUsed || 0}</p>
            <div className="row">
              <input type="number" value={add} onChange={(e) => setAdd(e.target.value)} style={{ width: 110 }} />
              <button className="btn primary" onClick={addBalance}>{t('addMin')}</button>
              <button className="btn" onClick={toggleVip}>{found.unlimited ? t('vipOff') : t('vipOn')}</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/* ============================ 7) التطبيق ============================ */
function Shell() {
  const { t, user, loading, verified, isAdmin, unlimited, balance, logout, resendVerification, refreshUser, profileErr } = useApp();
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
          <button className={tab === 'billing' ? 'tab active' : 'tab'} onClick={() => setTab('billing')}>{t('tabBilling')}</button>
          {isAdmin && <button className={tab === 'admin' ? 'tab active' : 'tab'} onClick={() => setTab('admin')}>{t('tabAdmin')}</button>}
        </nav>
        <div className="user-box">
          <LangSwitch />
          <span className={unlimited ? 'chip vip' : 'chip'}>{unlimited ? t('vip') : t('balance', { n: balance })}</span>
          <span className="email" dir="ltr">{user.email}</span>
          <button className="btn ghost small" onClick={logout}>{t('logout')}</button>
        </div>
      </header>
      <main className="container">
        {profileErr && <div className="banner"><b>{t('profileErrTitle')}:</b> <span dir="ltr">{profileErr}</span></div>}
        {tab === 'editor' && <Editor goBilling={() => setTab('billing')} />}
        {tab === 'billing' && <Billing />}
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
.links{display:flex;gap:14px;justify-content:center;margin-top:14px;font-size:.9rem;flex-wrap:wrap}
.err{color:var(--err)}.ok{color:var(--ok)}.hint{color:var(--mut);font-size:.9rem}
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
.big-number{font-size:3.2rem;font-weight:800}.big-number small{font-size:1rem;color:var(--mut)}
.packs{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.pack{display:flex;flex-direction:column;gap:6px;align-items:flex-start;background:#0d0d18;border:1px solid var(--line);border-radius:12px;padding:14px}
.price{font-size:1.6rem;color:var(--ok)}
.found{margin-top:14px;background:#0d0d18;border:1px solid var(--line);border-radius:12px;padding:14px}
.sep{display:flex;align-items:center;gap:10px;color:var(--mut);margin:14px 0 4px;font-size:.85rem}.sep:before,.sep:after{content:'';flex:1;height:1px;background:var(--line)}
.btn.google{background:#fff;color:#1f1f1f;border:0}.btn.google:hover{background:#f1f1f1}
.banner{background:#ff4d4d22;border:1px solid #ff4d4d88;border-radius:12px;padding:12px 16px;margin-bottom:16px;word-break:break-word}
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
