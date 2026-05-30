import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  // Bundle ID — debe coincidir EXACTAMENTE con el que crees en Apple Developer
  appId: 'ar.com.churchsystem.app',
  appName: 'Church System',
  webDir: 'dist',

  server: {
    // En desarrollo: apunta al backend local para hot-reload
    // En producción: comentar las dos líneas de abajo
    // url: 'http://192.168.x.x:4000/app',
    // cleartext: true,
    androidScheme: 'https',
  },

  ios: {
    // Ajusta el scheme si usás universal links
    scheme: 'churchsystem',
    backgroundColor: '#08090D',
    // Requiere que el backend use HTTPS en producción (ya lo hace vía Render/Cloudflare)
    allowsLinkPreview: false,
    scrollEnabled: true,
    contentInset: 'automatic',
    limitsNavigationsToAppBoundDomains: true,
  },

  plugins: {
    // Push notifications via APNs (nativas iOS)
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },

    // Status bar — se adapta al modo oscuro/claro de la app
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#08090D',
    },

    // Splash screen
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#08090D',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },

    // Permiso de cámara para scanner QR del check-in
    Camera: {
      // La descripción aparece en el diálogo de permiso de iOS
    },

    // Barcode scanning (plugin MLKit)
    BarcodeScanner: {
      // Permite múltiples formatos QR
    },
  },
}

export default config
