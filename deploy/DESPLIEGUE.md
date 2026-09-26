# FlipyERP Academy · despliegue en Hetzner

La academia corre **al lado** de FlipyERP en el mismo servidor, pero como
servicio independiente: su propio usuario del sistema (`academy`), su propia
base de datos (`academy`), su propio servicio systemd (`flipyerp-academy`) y su
propio vhost de nginx. No comparte base de datos ni código con el ERP.

```
Internet ─► nginx :443 academy.flipyerp.com ─► node 127.0.0.1:8090 ─► PostgreSQL (socket local, BD academy)
```

## Requisitos

- DNS: registro `A` (y `AAAA` si hay IPv6) de `academy.flipyerp.com` apuntando al servidor.
- Node.js 22.13 o superior (el servidor de FlipyERP no lo necesitaba hasta ahora).
- PostgreSQL y nginx: los que ya usa FlipyERP.

## Primera instalación (una sola vez, como root)

### 1. Node.js 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
node --version   # v22.x
```

### 2. Usuario del sistema y código

```bash
adduser --system --group --no-create-home --home /opt/academy --shell /bin/bash academy
install -d -o academy -g academy /opt/academy
sudo -u academy git clone -b main https://github.com/BOUROA/atlas.git /opt/academy
```

> Si el repositorio es privado, usa una *deploy key* de solo lectura para el
> usuario `academy`, igual que en FlipyERP.

### 3. Base de datos propia

Autenticación *peer* por socket: el usuario del sistema `academy` entra como el
rol `academy` sin contraseña.

```bash
sudo -u postgres createuser academy
sudo -u postgres createdb -O academy academy
```

### 4. Configuración

```bash
install -o root -g academy -m 640 /opt/academy/deploy/academy.env.example /opt/academy/academy.env
```

### 5. Permiso para reiniciar solo este servicio

```bash
echo 'academy ALL=(root) NOPASSWD: /usr/bin/systemctl restart flipyerp-academy' > /etc/sudoers.d/academy
chmod 440 /etc/sudoers.d/academy
visudo -c
```

### 6. Servicio systemd

```bash
cp /opt/academy/deploy/flipyerp-academy.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable flipyerp-academy
```

### 7. Primer build, migraciones y arranque

```bash
sudo -iu academy
cd /opt/academy && FORCE=1 bash deploy/deploy.sh
```

El script instala, pasa los tests, valida el contenido contra
`/opt/flipyerp/FlipyERP_v1.0.1`, compila, migra y arranca.

### 8. nginx y certificado

```bash
cp /opt/academy/deploy/nginx-academy.conf /etc/nginx/sites-available/academy
# La primera vez aún no hay certificado: se obtiene con el bloque :80 solo.
certbot certonly --nginx -d academy.flipyerp.com
ln -s /etc/nginx/sites-available/academy /etc/nginx/sites-enabled/academy
nginx -t && systemctl reload nginx
```

### 9. Tu usuario administrador

```bash
sudo -iu academy
cd /opt/academy/atlas
set -a; . /opt/academy/academy.env; set +a
node server/academy/cli.mjs bootstrap --org "Grupo Troviscal" --email tu@correo --name "Tu nombre"
```

La contraseña se pide por consola: nunca como argumento, para que no quede en
el historial.

Entra en `https://academy.flipyerp.com`, y desde el icono de personas de la
cabecera (o `/admin`) invita a las demás personas.

## Despliegues siguientes

```bash
ssh academy@<servidor> "bash /opt/academy/deploy/deploy.sh"
```

Qué hace, en orden:

1. Se bloquea para que no corran dos despliegues a la vez.
2. Trae el código.
3. Instala, pasa los tests, valida el contenido y compila **antes** de tocar el servicio. Si algo falla aquí, producción no se entera.
4. Copia la base de datos.
5. Aplica las migraciones.
6. Reinicia y hace el health check. Si falla, vuelve al commit anterior y restaura la copia.

## Operación

| Tarea | Comando |
|---|---|
| Estado del servicio | `systemctl status flipyerp-academy` |
| Logs | `journalctl -u flipyerp-academy -f` |
| Log de despliegues | `/opt/academy/logs/deploy.log` |
| Copia manual de la BD | `sudo -u academy pg_dump academy -Fc -f /opt/academy/backups/manual.dump` |
| Restablecer una contraseña | `node server/academy/cli.mjs reset-password --email x@y` (con el `.env` cargado) |

Las copias de la base de datos de FlipyERP **no** incluyen la academia: si
tienes copias externas programadas, añade `academy` a la lista.
