import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// لا حاجة لترويسات COOP/COEP: ffmpeg أحادي الخيط لا يستخدم SharedArrayBuffer،
// ووجودها كان يعطّل نافذة Google المنبثقة.
export default defineConfig({
  plugins: [react()],
  optimizeDeps: { exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'] },
});
