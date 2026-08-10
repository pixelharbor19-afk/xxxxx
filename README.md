cluster mode next js

cd ~/apps/player

pm2 delete player

pm2 start node_modules/next/dist/bin/next --name player -i 4 -- start

pm2 save

==========================
🟢 Changed code only
git pull
npm install
npm run build
pm2 restart player
🟢 github save
git config --global credential.helper
🟢 Changed .env.local
npm run build
pm2 restart player --update-env
=============================
🔐 CONNECT TO VPS
=============================

ssh deploy@45.151.91.13

=============================
📁 GO TO PROJECT
=============================

cd ~/apps/player

=============================
🚀 DEPLOY NEW UPDATE
=============================

git pull
npm install
npm run build
pm2 restart player --update-env

=============================
📊 PM2
=============================

pm2 list # Show running apps
pm2 logs player # Live logs
pm2 restart player # Restart app
pm2 restart player --update-env # Restart + reload .env.local
pm2 stop player # Stop app
pm2 start player # Start app
pm2 delete player # Remove app
pm2 save # Save process list for reboot
pm2 monit # Live CPU/RAM monitor

=============================
🌐 NGINX
=============================

sudo systemctl status nginx
sudo systemctl restart nginx
sudo systemctl reload nginx
sudo nginx -t

=============================
📈 NETDATA
=============================

sudo systemctl status netdata
sudo systemctl restart netdata

=============================
🖥 SYSTEM
=============================

htop # Live CPU/RAM
df -h # Disk usage
free -h # RAM usage
uptime # Server uptime/load
top # Process monitor
neofetch # System info (if installed)

=============================
🌍 NETWORK
=============================

curl ipinfo.io
curl ifconfig.co/json

ping google.com

=============================
📂 FILES
=============================

ls
ls -la
pwd
cd
mkdir folder
rm file
rm -rf folder

=============================
📝 EDIT FILES
=============================

nano .env.local

Ctrl + O Save
Enter
Ctrl + X Exit

=============================
🔍 VIEW FILE
=============================

cat .env.local
less .env.local

=============================
📜 LOGS
=============================

pm2 logs player

sudo journalctl -u nginx -f

sudo journalctl -u netdata -f

=============================
🔒 SSH
=============================

who
w

=============================
🔄 REBOOT
=============================

sudo reboot

=============================
📦 UPDATE SERVER
=============================

sudo apt update
sudo apt upgrade -y

=============================
🔍 CHECK PORTS
=============================

sudo ss -tulpn

=============================
🌍 TEST WEBSITE
=============================

curl -I https://player.zxcstream.xyz

=============================
🔥 FIREWALL
=============================

sudo ufw status
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 22

=============================
📊 DISK
=============================

du -sh \*
df -h

=============================
💾 BACKUP .ENV
=============================

cp .env.local .env.local.backup

=============================
🧹 DELETE BUILD
=============================

rm -rf .next

=============================
🛠 REBUILD FROM SCRATCH
=============================

rm -rf .next
npm install
npm run build
pm2 restart player --update-env
