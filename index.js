const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const fs = require('fs');
const axios = require('axios');
const qrcode = require('qrcode-terminal');
const moment = require('moment-timezone');
const { nocache } = require('./lib/function');
const { color } = require('./lib/color');

require('./message.js');
nocache('../message.js', module => console.log(color('[ CHANGE ]', 'green'), color(`'${module}'`, 'green'), 'Updated'));

const logger = require('pino')({ level: 'silent' });

async function startBot() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
        const { version } = await fetchLatestBaileysVersion();
        
        const sock = makeWASocket({
            version,
            auth: state,
            logger,
        });

        sock.ev.on('creds.update', saveCreds);

        let isConnected = false;

        sock.ev.on('connection.update', (update) => {
            try {
                const { qr, connection, lastDisconnect } = update;

                if (qr) {
                    qrcode.generate(qr, { small: true }, (qrcode) => {
                        console.log('Scan QR Code to login:');
                        console.log(qrcode);
                    });
                }

                if (connection === 'open') {
                    console.log('✅ Bot successfully connected to WhatsApp!');
                    isConnected = true;
                }
                if (connection === 'connecting') {
                    console.log('🔄 Bot is connecting to WhatsApp...');
                    isConnected = false;
                }

                if (connection === 'close') {
                    console.log('❌ Bot connection closed.');
                    isConnected = false;
                    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
                    if (shouldReconnect) {
                        console.log('🔄 Reconnecting...');
                        startBot();
                    } else {
                        console.log('🔒 Session expired. Hapus folder "auth_info" dan login ulang.');
                    }
                }
            } catch (err) {
                console.error("Error in connection update:", err);
            }
        });

        // sock.ev.on('call', async (call) => {
        //     const { id, status, isVideo, from: peerJid } = call[0];
        
        //     if (status === 'offer') {
        //         await sock.rejectCall(id, peerJid)
        
        //         if (isVideo) {
        //             console.log(color('Video call rejected from', 'red'), color(`${peerJid.split('@')[0]}`, 'yellow'));
        //         } else {
        //             console.log(color('Voice call rejected from', 'red'), color(`${peerJid.split('@')[0]}`, 'yellow'));
        //         }
        //     }
        // });

        sock.ev.on('messages.upsert', async (message) => {
            const handleMessages = require('./message');
            await handleMessages(sock, message);
        });

        function getTomorrowSchedule(data) {
            let response = [];
        
            const days = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];
            const todayIndex = moment().tz('Asia/Jakarta').day();
            const tomorrowIndex = (todayIndex + 1) % 7;
            const tomorrow = days[tomorrowIndex];
        
            for (const id in data) {
                if (data[id] && data[id][tomorrow]) {
                    const schedule = data[id][tomorrow];
                    if (Array.isArray(schedule) && schedule.length > 0) {
                        response.push({ tomorrow, id, schedule });
                    }
                }
            }
        
            return response;
        }    

        async function getRamadhanSchedule() {
            const data = JSON.parse(await fs.promises.readFile('./database/api.json', 'utf-8'));
        
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const formattedDate = tomorrow.toISOString().split('T')[0];
        
            const api = await axios.get(`https://api.myquran.com/v2/sholat/jadwal/1638/${formattedDate}`);
            data["data"] = api.data.data.jadwal;
        
            await fs.promises.writeFile('./database/api.json', JSON.stringify(data, null, 2));
            console.log("✅ Ramadhan schedule updated for", formattedDate);
        }

        setInterval(async () => {
            try {
                if (!isConnected) {
                    console.log('⏳ Menunggu koneksi stabil sebelum mengirim reminder...');
                    return;
                }
                
                const data = JSON.parse(await fs.promises.readFile('./database/database.json', 'utf-8'));
                const apiData = JSON.parse(await fs.promises.readFile('./database/api.json', 'utf-8'));
                const jadwalSholat = apiData.data;
                
                const now = moment().tz('Asia/Jakarta');
                const currentTime = now.format('HH:mm');
                
                if (now.hour() === 23 && now.minute() === 59) {
                    await getRamadhanSchedule();
                }

                const imsak15MinBefore = moment(jadwalSholat.imsak, 'HH:mm').subtract(15, 'minutes').format('HH:mm');
                const maghrib30MinBefore = moment(jadwalSholat.maghrib, 'HH:mm').subtract(30, 'minutes').format('HH:mm');
                const imsakTime = jadwalSholat.imsak;
                const maghribTime = jadwalSholat.maghrib;

                for (const id of Object.keys(data)) {
                    if (data[id]?.ramadhan === true) {
                        const groupMetadata = await sock.groupMetadata(id);
                        const members = groupMetadata.participants;
                        const mentions = members.map(member => member.id);
                        
                        if (now.hour() === 3 && now.minute() === 5) {
                                await sock.sendMessage(id, { video: fs.readFileSync(apiData["video"]), ptv: true, mentions: mentions }
                            )
                        }

                        // Reminder 15 menit sebelum imsak
                        if (currentTime === imsak15MinBefore) {
                            await sock.sendMessage(id, {
                                text: `⏰ *Reminder Waktu Imsak* ⏰\n\nSegera selesaikan sahur *@everyone*, 15 menit lagi menuju waktu imsak!`,
                                mentions: mentions
                            });
                        }

                        // Reminder saat imsak
                        if (currentTime === imsakTime) {
                            await sock.sendMessage(id, {
                                text: `🕌 *Waktu Imsak Telah Tiba* 🕌\n\n_"${apiData["quotes"]}"_\n\nSemoga puasa hari ini lancar *@everyone*`,
                                mentions: mentions
                            });
                        }

                        // Reminder 30 menit sebelum maghrib
                        if (currentTime === maghrib30MinBefore) {
                            await sock.sendMessage(id, {
                                text: `⏰ *Reminder Waktu Maghrib* ⏰\n\nSegera persiapkan untuk berbuka puasa *@everyone*, waktu maghrib 30 menit lagi!`,
                                mentions: mentions
                            });
                        }

                        // Reminder saat maghrib
                        if (currentTime === maghribTime) {
                            await sock.sendMessage(id, {
                                text: `🕌 *Waktu Maghrib Telah Tiba* 🕌\n\nاَللّٰهُمَّ لَكَ صُمْتُ وَبِكَ اٰمَنْتُ وَعَلَى رِزْقِكَ اَفْطَرْتُ\n\nSelamat berbuka puasa *@everyone*.`,
                                mentions: mentions
                            });
                        }
                    }
                }
            } catch (error) {
                console.error('❌ Error dalam pengiriman reminder waktu sholat:', error);
            }
        }, 60000);
        
        setInterval(async () => {
            try {
                if (!isConnected) {
                    console.log('⏳ Menunggu koneksi stabil sebelum mengirim reminder...');
                    return;
                }
                
                const data = JSON.parse(await fs.promises.readFile('./database/database.json', 'utf-8'));
                const now = moment().tz('Asia/Jakarta');
                const formattedNow = now.format('DD/MM/YYYY HH:mm');
                const formattedH1 = now.clone().add(1, 'day').format('DD/MM/YYYY HH:mm');
                const formattedH1HourBefore = now.clone().add(1, 'hour').format('DD/MM/YYYY HH:mm');

                for (const id of Object.keys(data)) {
                    if (data[id]?.reminder?.length > 0) {
                        const groupMetadata = await sock.groupMetadata(id);
                        const members = groupMetadata.participants;
                        const mentions = members.map(member => member.id);
        
                        for (const reminder of data[id].reminder) {
                            if (reminder.deadline === formattedNow) {
                                await sock.sendMessage(id, { 
                                    text: `⏰ *Reminder @everyone* ⏰\nPesan ini disetting oleh @${reminder.user.split('@')[0]}\n\n${reminder.pesan}`, 
                                    mentions: mentions,
                                }, { quoted: reminder.chat });
        
                                reminder.status = 'DONE';
                            }
                        }
                        data[id].reminder = data[id].reminder.filter(reminder => reminder.status !== 'DONE');
                    }
        
                    if (data[id]?.tugas?.length > 0) {
                        const groupMetadata = await sock.groupMetadata(id);
                        const members = groupMetadata.participants;
                        const mentions = members.map(member => member.id);
        
                        for (const tugas of data[id].tugas) {
                            if (tugas.deadline.startsWith(formattedH1)) {
                                await sock.sendMessage(id, {
                                    text: `⏰ *Reminder Tugas H-1* ⏰\n\n📖 *Mata Kuliah:* ${tugas.matkul}\n⏳ *Deadline:* ${tugas.deadline}\n📝 *Deskripsi:* ${tugas.deskripsi}\n\nSegera selesaikan tugasmu, *@everyone*!`,
                                    mentions: mentions
                                });
                            }
                            if (tugas.deadline === formattedH1HourBefore) {
                                await sock.sendMessage(id, {
                                    text: `⏰ *Reminder Tugas 1 Jam Sebelum Deadline* ⏰\n\n📖 *Mata Kuliah:* ${tugas.matkul}\n⏳ *Deadline:* ${tugas.deadline}\n📝 *Deskripsi:* ${tugas.deskripsi}\n\nSegera kumpulkan tugasmu sebelum terlambat, *@everyone*!`,
                                    mentions: mentions
                                });
                            }
                        }
                    }
                }
        
                await fs.promises.writeFile('./database/database.json', JSON.stringify(data, null, 2));
        
                if (now.hour() === 18 && now.minute() === 35) {
                    const jadwal = getTomorrowSchedule(data);
                    if (jadwal.length > 0) {
                        for (const { tomorrow, id, schedule } of jadwal) {
                            const groupMetadata = await sock.groupMetadata(id);
                            const members = groupMetadata.participants;
                            const mentions = members.map(member => member.id);
        
                            const calculateSKS = (jam) => {
                                const [startTime, endTime] = jam.split(' - ').map(t => t.trim());
                                const [startHour, startMinute] = startTime.split('.').map(Number);
                                const [endHour, endMinute] = endTime.split('.').map(Number);
                                return Math.ceil(((endHour * 60 + endMinute) - (startHour * 60 + startMinute)) / 50);
                            };
        
                            let message = `*JADWAL MATA KULIAH BESOK (${tomorrow.toUpperCase()})*\n\n`;
                            schedule.sort((a, b) => {
                                const timeA = a.jam.split(' - ')[0].trim();
                                const timeB = b.jam.split(' - ')[0].trim();
                                return timeA.localeCompare(timeB);
                            });
        
                            schedule.forEach((jadwal) => {
                                message += `📖 *Mata Kuliah:* ${jadwal.matkul}\n`;
                                message += `🏫 *Ruangan:* ${jadwal.ruangan}\n`;
                                message += `🕒 *Jam:* ${jadwal.jam} ( ${calculateSKS(jadwal.jam)} SKS )\n`;
                                message += `👤 *Penanggung Jawab:* ${jadwal.pj.map(p => `@${p.split('@')[0]}`).join(', ')}\n\n`;
                            });
        
                            message += `*Keep fighting 🔥, @everyone*`;
                            await sock.sendMessage(id, { text: message, mentions: mentions });
                        }
                    }
                }
            } catch (error) {
                console.error('❌ Error dalam pengecekan reminder atau jadwal:', error);
            }
        }, 60000);               
    } catch (err) {
        console.error("Error starting bot:", err);
    }
}

startBot()