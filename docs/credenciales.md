# Credenciales de prueba

## Valores por defecto

| Campo | Valor |
|---|---|
| Correo | `admin@crm.local` |
| Contraseña | `admin1234` |
| Ruta de acceso | `/login` |

Funcionan **inmediatamente después de `npm run setup`** (o `npm run seed`),
sin configurar nada más. Es lo que permite abrir el proyecto y probarlo de
inmediato, en local o en el despliegue de Vercel.

> ⚠️ **Estas credenciales son públicas**: están en el README, en `.env.example`
> y en el código, y el repositorio es público. Cualquiera que abra tu
> despliegue puede entrar. Son solo para la demo: cámbialas en cuanto accedas.

## Cómo funciona

`scripts/seed.ts` guarda en la tabla `Setting`:

| Clave | Contenido |
|---|---|
| `auth.admin.email` | `admin@crm.local` |
| `auth.admin.passwordHash` | hash bcrypt de la contraseña, en base64 |

`src/lib/auth.ts` lee esas dos filas en cada login y compara con `bcrypt`.
Como la contraseña nunca está en texto plano, el valor por defecto se genera al
volar:

```ts
// scripts/seed.ts
const defaultPassword = "admin1234";
hashB64 = Buffer.from(bcrypt.hashSync(defaultPassword, 12)).toString("base64");
```

Si defines `ADMIN_PASSWORD_HASH_B64`, el seed usa ese hash en lugar del
temporal, así que puedes fijar la contraseña desde el entorno sin tocar código.

## Cambiar la contraseña (recomendado)

1. Entra con las credenciales de prueba.
2. Ve a **`/settings`**.
3. Cambia la contraseña; se rehashea y se guarda en la BD.

El cambio persiste aunque se vuelva a desplegar: vive en PostgreSQL, no en el
código.

## Fijar la contraseña desde el entorno

```bash
node -e "console.log(Buffer.from(require('bcryptjs').hashSync('MI-CONTRASENA',12)).toString('base64'))"
```

Copia el resultado en `ADMIN_PASSWORD_HASH_B64` (en `.env` local y/o en las
variables de Vercel) y ejecuta `npm run setup`.

## Restablecer a los valores de fábrica

```bash
# deja ADMIN_PASSWORD_HASH_B64 vacío y vuelve a sembrar
npm run setup
```

Esto sobrescribe el hash con el de `admin1234` y el correo con el de
`ADMIN_EMAIL`.

## Hardening para producción

1. Cambia la contraseña en `/settings` (no uses `admin1234`).
2. Define `CRON_SECRET` y `NEXTAUTH_SECRET` con valores aleatorios:

   ```bash
   openssl rand -base64 32
   ```

3. Usa `ADMIN_EMAIL` con tu correo real.
4. Considera meter Vercel delante de un dominio propio y activar
   *Deployment Protection* si el CRM maneja datos sensibles.

Todo el acceso es de un único administrador: no hay registro de usuarios ni
roles, por diseño.
