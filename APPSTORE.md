# Guía App Store — Church System

> Proceso completo para publicar en Apple App Store.
> Último update: 2026-05-30

---

## Estado actual del código

| Requisito App Store | Estado |
|---|---|
| `capacitor.config.ts` configurado | ✅ listo |
| `manifest.json` con `start_url: "/app/"` | ✅ listo |
| Eliminación de cuenta en-app (guideline 5.1.1) | ✅ listo |
| Escaneo QR nativo con cámara (guideline 4.2.2) | ✅ listo |
| `NSCameraUsageDescription` en Info.plist | ⚠️ configurar en Xcode |
| Icono 1024×1024 sin transparencia | ⚠️ pendiente (ver paso 4) |
| Privacy Policy URL | ⚠️ pendiente |

---

## Paso 1 — Registrarse como Apple Developer

1. Ir a https://developer.apple.com/programs/enroll/
2. Iniciar sesión con tu Apple ID
3. Elegir **Individual** (no empresa) → pago de **USD 99/año**
4. Esperar aprobación por email: **24–48 horas hábiles**

> No podés generar certificados ni subir a App Store hasta que la cuenta esté aprobada.

---

## Paso 2 — Instalar herramientas locales

Estas dependencias **solo se necesitan en tu Mac**. El código ya está listo en el repo.

```bash
# 1. Instalar Xcode desde la Mac App Store (gratuito, ~7 GB)
# Abrir Xcode una vez para aceptar licencias

# 2. Instalar Xcode Command Line Tools
xcode-select --install

# 3. Node.js (si no lo tenés)
# https://nodejs.org → descargar v20 LTS

# 4. pnpm (si no lo tenés)
npm install -g pnpm
```

---

## Paso 3 — Preparar el proyecto Capacitor en tu Mac

```bash
# Clonar el repo en tu Mac
git clone https://github.com/valentinalvarezgg-system/churchsystem.git
cd churchsystem/frontend

# Instalar dependencias (incluye @capacitor/core y @capacitor-mlkit/barcode-scanning)
pnpm install

# Construir la app web
pnpm run build

# Inicializar Capacitor (solo la primera vez)
npx cap init "Church System" "ar.com.churchsystem.app" --web-dir dist

# Agregar la plataforma iOS
npx cap add ios

# Sincronizar archivos web con Xcode
npx cap sync ios

# Abrir en Xcode
npx cap open ios
```

---

## Paso 4 — Configurar Xcode

### 4.1 Firma de código (Signing)

1. En Xcode: seleccionar el target **App**
2. Pestaña **Signing & Capabilities**
3. Marcar **Automatically manage signing**
4. Team: seleccionar tu Apple Developer account
5. Bundle Identifier: `ar.com.churchsystem.app`

### 4.2 Icono de la app

Apple requiere un icono **1024×1024 px**, formato PNG, **sin transparencia** (fondo sólido).

- Usar el mismo diseño del logo de Church System
- Herramienta para generar todos los tamaños: https://appicon.co
- Arrastrar los iconos generados a `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

### 4.3 Permisos de cámara (Info.plist)

La app usa la cámara para escanear QR de check-in. Apple requiere una descripción:

1. En Xcode, abrir `ios/App/App/Info.plist`
2. Agregar la clave:

```xml
<key>NSCameraUsageDescription</key>
<string>Church System usa la cámara para escanear códigos QR de registro de asistencia.</string>
```

3. También agregar para el plugin MLKit:

```xml
<key>NSPhotoLibraryUsageDescription</key>
<string>Acceso a fotos para el perfil de usuario.</string>
```

### 4.4 Orientación

Ya configurado en `capacitor.config.ts`:
- `orientation: any` (soporta portrait y landscape)

---

## Paso 5 — TestFlight (prueba antes de publicar)

```bash
# Asegurarse de que el build web esté actualizado
cd frontend
pnpm run build
npx cap sync ios

# Abrir Xcode
npx cap open ios
```

En Xcode:
1. Seleccionar **Any iOS Device (arm64)** como destino
2. **Product → Archive**
3. Ventana **Organizer** → seleccionar el archive → **Distribute App**
4. Elegir **App Store Connect**
5. Seguir el wizard → subir

En App Store Connect (https://appstoreconnect.apple.com):
1. Build aparece en **TestFlight** tab en ~15 minutos
2. Agregar testers internos (hasta 25 Apple IDs)
3. Testers descargan la app desde la app TestFlight en su iPhone

---

## Paso 6 — Información para App Store Connect

### Datos obligatorios

| Campo | Valor |
|---|---|
| Name | Church System |
| Subtitle | Gestión pastoral para iglesias |
| Bundle ID | ar.com.churchsystem.app |
| Category | Productivity |
| Language | Spanish |
| Age Rating | 4+ |

### Descripción (en español)

```
Church System es la plataforma de gestión pastoral diseñada para iglesias.

Funciones principales:
• Registro y seguimiento de miembros y visitantes
• Check-in QR nativo con la cámara del celular
• Comunicados y mensajes a la congregación
• Control de asistencia a cultos
• Grupos y discipulado
• Finanzas y eventos

La app permite que los miembros registren su asistencia escaneando el código QR 
del culto directamente desde la cámara nativa del celular.

Eliminar tu cuenta: en Mi Perfil → Zona de peligro → Eliminar mi cuenta.
```

### Keywords

```
iglesia, pastor, congregación, asistencia, check-in, discipulado, QR, grupos, miembros
```

### Privacy Policy URL

Crear una página de política de privacidad antes de publicar. Apple la exige.
Servicio gratuito: https://www.privacypolicygenerator.info

---

## Paso 7 — Capturas de pantalla

Apple requiere capturas para:
- iPhone 6.9" (iPhone 16 Pro Max): 1320×2868 px
- iPhone 6.7" (iPhone 14 Plus): 1242×2778 px

Usá un iPhone real o el simulador de Xcode:
1. Xcode → Simulador → elegir iPhone 16 Pro Max
2. Correr la app → hacer capturas con `Cmd+S`
3. Las capturas se guardan en el escritorio

---

## Comandos rápidos de referencia

```bash
# Actualizar la app tras cambios en el código
cd frontend && pnpm run build && npx cap sync ios

# Abrir Xcode
npx cap open ios

# Script shortcut (definido en package.json)
pnpm run ios
```

---

## Versioning

| Versión | Build Number | Notas |
|---|---|---|
| 1.0.0 | 1 | Primera versión App Store |

Incrementar el **Build Number** en Xcode cada vez que se sube un nuevo build a App Store Connect.

---

## Contacto de soporte (requerido por Apple)

Apple pide un email de soporte visible en la App Store:

- **Email**: soporte@churchsystem.com.ar
- **URL de soporte**: https://churchsystem.com.ar

---

## Checklist final antes de enviar a revisión

- [ ] Cuenta Apple Developer aprobada
- [ ] Bundle ID `ar.com.churchsystem.app` creado en Certificates, Identifiers & Profiles
- [ ] App ID con capability **Push Notifications** habilitada
- [ ] Icono 1024×1024 sin transparencia cargado
- [ ] `NSCameraUsageDescription` en Info.plist
- [ ] Privacy Policy URL activa
- [ ] TestFlight probado en iPhone real
- [ ] Capturas de pantalla cargadas en App Store Connect
- [ ] Descripción, keywords y categoría completados
- [ ] Funcionalidad de eliminación de cuenta verificada (Mi Perfil → Zona de peligro)
- [ ] QR scanner nativo probado en iPhone real (no en simulador)
