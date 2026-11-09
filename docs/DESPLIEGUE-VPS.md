# Despliegue en un servidor propio (VPS en España) con Docker

Todo corre en una sola máquina, con cuatro contenedores:

| Servicio | Qué hace |
|---|---|
| `app` | La web y la API. Al arrancar aplica el esquema de la base de datos y los disparadores de solo anotación. Sella cada 15 minutos lo que quedara pendiente. |
| `db` | PostgreSQL 16. Los datos van en el volumen `datos`. |
| `caddy` | HTTPS automático con Let's Encrypt, compresión y cabeceras de seguridad. |
| `copias` | Copia de la base de datos al arrancar y luego cada 24 h. Guarda los últimos 30 días en el volumen `copias`. |

Tiempo estimado: una hora la primera vez.

## 1. Contratar el servidor

- **Dónde:** un proveedor con centro de datos en España, por ejemplo Clouding.io (Barcelona), Arsys o IONOS (Madrid).
  Así los datos no salen de España, algo que conviene decir en la política de privacidad.
- **Tamaño:** 2 vCPU, 2–4 GB de RAM y 25–40 GB de disco bastan para cientos de personas. Cuesta unos 6–12 € al mes.
- **Sistema:** Ubuntu 24.04 LTS.
- **Acceso:** con **clave SSH**, no con contraseña. Si el proveedor ofrece copias automáticas del servidor
  (*snapshots*), actívalas.

## 2. El dominio

En el panel donde se gestione el DNS de `ugtclmgranada.org`, crea un registro:

```
jornada   A   <IP del servidor>
```

Si el servidor tiene IPv6, crea también un registro `AAAA`. La web actual de la sección no se toca. Espera a que
`ping jornada.ugtclmgranada.org` responda con la IP del servidor.

## 3. Preparar el servidor

Entra por SSH y ejecuta:

```bash
sudo apt update && sudo apt -y upgrade
sudo apt -y install unattended-upgrades git ufw
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw --force enable
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

Cierra la sesión y vuelve a entrar para que el grupo `docker` surta efecto.

## 4. Descargar el código

El repositorio es privado, así que el servidor necesita una **clave de despliegue** de solo lectura:

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/jornada_deploy
cat ~/.ssh/jornada_deploy.pub
```

En GitHub, entra en el repositorio y ve a *Settings → Deploy keys → Add deploy key*. Pega esa clave y **no** marques
*Allow write access*. Después, en el servidor:

```bash
cat >> ~/.ssh/config <<'EOF'
Host github.com
  IdentityFile ~/.ssh/jornada_deploy
EOF
git clone git@github.com:elcorreveidile/ugt-clm-jornada.git
cd ugt-clm-jornada
```

## 5. Configurar

```bash
cp .env.produccion.example .env
openssl rand -hex 24          # copia el resultado en POSTGRES_PASSWORD
nano .env
```

Rellena el dominio, la contraseña de la base de datos, la clave de Brevo y los datos del responsable del tratamiento.
El fichero `.env` no se sube nunca a GitHub. Guarda una copia de la contraseña en un sitio seguro: sin ella, las copias
de la base de datos siguen sirviendo, pero no podrás entrar en la base de datos actual.

## 6. Arrancar

```bash
docker compose up -d --build
docker compose ps             # app, db, caddy y copias deben estar «running»
docker compose logs -f app    # debe terminar en «Registro de jornada en el puerto 3000»
```

Abre `https://jornada.ugtclmgranada.org`. El certificado HTTPS tarda unos segundos en emitirse la primera vez.

## 7. Correo (Brevo)

En Brevo, en *Senders, Domains & Dedicated IPs*, añade y verifica el dominio `ugtclmgranada.org`. Brevo te dará
registros DNS (DKIM y DMARC) para añadir al mismo panel de antes. Sin este paso, los correos de acceso pueden acabar en
spam.

Pruébalo: entra en la web, pide el enlace con tu correo y comprueba que llega.

## 8. Copias de seguridad

Las copias diarias están **dentro del mismo servidor**. Si el servidor se pierde, se pierden con él, así que hay que
sacarlas fuera con regularidad. Desde tu ordenador:

```bash
ssh usuario@IP "cd ugt-clm-jornada && docker compose cp copias:/copias ./copias-descarga && tar czf - copias-descarga && rm -rf copias-descarga" > copias-jornada-$(date +%F).tar.gz
```

Recomendado: hacerlo cada semana y guardar el fichero en un disco o una nube de la sección. A eso se suman los
*snapshots* del proveedor.

Las copias contienen datos personales. Guárdalas cifradas o en un sitio de acceso restringido.

### Restaurar una copia

```bash
docker compose stop app
docker compose exec db psql -U jornada -d postgres -c "DROP DATABASE jornada"
docker compose exec db psql -U jornada -d postgres -c "CREATE DATABASE jornada"
docker compose cp jornada-AAAA-MM-DD_HHMM.sql.gz copias:/tmp/restaurar.sql.gz
docker compose exec copias sh -c 'gunzip -c /tmp/restaurar.sql.gz | psql -h db -U jornada -d jornada'
docker compose start app
```

La copia incluye los disparadores de solo anotación. Restaurar no rompe la prueba: la cadena de huellas y los sellos
siguen verificándose igual.

## 9. Actualizar a una versión nueva

```bash
cd ugt-clm-jornada
git pull
docker compose up -d --build
```

Al arrancar, la app aplica los cambios del esquema. Si un cambio implicara borrar datos, Prisma se niega y la app no
arranca: en ese caso, no fuerces nada y avisa a quien la mantiene.

## 10. Mantenimiento

- Ver qué pasa: `docker compose logs --tail 100 app`.
- Espacio en disco: `df -h` y `docker system df`. De vez en cuando, `docker image prune -f`.
- El sistema operativo se actualiza solo (`unattended-upgrades`). Reinicia el servidor de vez en cuando:
  los contenedores vuelven a arrancar solos.
- Para mayor seguridad, desactiva en `/etc/ssh/sshd_config` el acceso de `root` y el acceso con contraseña.

## Quién administra el servidor

Quien tenga acceso al servidor puede leer la base de datos. No puede alterar el registro sin que se note, porque la
cadena de huellas y los sellos de tiempo lo delatan, pero sí puede ver los datos. Conviene que lo administren una o
dos personas de confianza de la sección y que eso figure en la política de privacidad.
