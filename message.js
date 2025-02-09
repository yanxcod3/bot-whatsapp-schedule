const fs = require('fs');
const moment = require('moment-timezone');
const { text } = require('stream/consumers');
const { color, bgcolor } = require('./lib/color');

const path = './database/database.json';
let jadwal = {};
let reminder = {};

async function checkData(id) {
    if (!fs.existsSync(path)) {
        fs.writeFileSync(path, JSON.stringify({}, null, 2));
    }

    const data = JSON.parse(await fs.promises.readFile(path, 'utf8'));
    if (!data[id]) {
        data[id] = {
            "senin": [], "selasa": [], "rabu": [], "kamis": [], "jumat": [], "sabtu": [], "minggu": [], "reminder": []
        };
    }

    await fs.promises.writeFile(path, JSON.stringify(data, null, 2));
    return data;
}

const calculateSKS = (jam) => {
    const [startTime, endTime] = jam.split(' - ').map(t => t.trim());
    const [startHour, startMinute] = startTime.split('.').map(Number);
    const [endHour, endMinute] = endTime.split('.').map(Number);
    
    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;
    const durationInMinutes = endTotalMinutes - startTotalMinutes;

    return Math.ceil(durationInMinutes / 50);
};

module.exports = async function handleMessages(sock, message) {
    const m = message.messages[0];
    const sender = m.key.remoteJid;
    const isGroup = sender.endsWith('@g.us');
    const groupMetadata = isGroup ? await sock.groupMetadata(sender) : '';
    const admins = isGroup ? groupMetadata.participants.filter(participant => participant.admin === 'admin' || participant.admin === 'superadmin').map(admin => admin.id) : '';
    const isAdmin = admins.includes(m.key.participant)
    const command = m.message?.conversation || m.message?.extendedTextMessage?.text;
    const args = command?.toLowerCase().split(' ');
    
    const quotedMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage ? m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text : m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation;

    const hari = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];

    if(!command) return
    if (!m.key.fromMe) {
        if (isGroup) {
            console.log(
                color('=>', 'green'),
                color(command?.toLowerCase(), 'yellow'),
                bgcolor(color(` Group: ${groupMetadata.subject} `, 'black'), 'green'),
                bgcolor(color(` From: `, 'black'), 'white'),
                color(`${m.pushName}`, 'blue')
            );
        } else {
            console.log(
                color('=>', 'green'),
                color(command?.toLowerCase(), 'yellow'),
                bgcolor(color(` Private Message from `, 'black'), 'white'),
                color(`${m.pushName}`, 'blue')
            );
        }

        switch (args[0]) {
            case '!help':
                let message = `List of Commands:\n`;
                message += '*• !list-schedule* - View the list of course schedules\n';
                message += '*• !set-jadwal* - Set the course schedule\n';
                message += '*• !reminder* - Set a reminder message\n';
                await sock.sendMessage(sender, { text: message }, { quoted: m });
            break;
            case '!list-jadwal':
                try {
                    const data = await checkData(sender);
                    let mentions = [];
                    let isFound = false;
                    let message = `*JADWAL MATA KULIAH ${groupMetadata.subject}*\n\n`;

                    const hariInput = args[1]?.toLowerCase();
                    
                    if(hariInput) {
                        if (!hari.includes(hariInput)) return sock.sendMessage(sender, { text: '*Hari tidak valid!* Parameter hari:\n' + hari.join(', ') }, { quoted: m });
                        if (data[sender][hariInput].length > 0) {
                            isFound = true;
                            message += `📌 *${hariInput.toUpperCase()}*\n`;

                            data[sender][hariInput].sort((a, b) => {
                                const timeA = a.Jam.split(' - ')[0].trim();
                                const timeB = b.Jam.split(' - ')[0].trim();
                                return timeA.localeCompare(timeB);
                            });

                            data[sender][hariInput].forEach((jadwal) => {
                                const pjMentions = jadwal.pj.map(pj => `@${pj.split('@')[0]}`).join(", ");
                                message += `📖 *Mata Kuliah:* ${jadwal.matkul}\n`;
                                message += `🏫 *Ruangan:* ${jadwal.ruangan}\n`;
                                message += `🕒 *Jam:* ${jadwal.Jam} ( ${calculateSKS(jadwal.Jam)} SKS )\n`;
                                message += `👤 *Penanggung Jawab:* ${pjMentions}\n\n`;
                                mentions.push(...jadwal.pj);
                            });
                        }

                        if (!isFound) {
                            message = `*Jadwal belum diatur!* Gunakan perintah *!set-jadwal* untuk mengatur jadwal.`;
                        }
                        await sock.sendMessage(sender, { text: message, mentions: mentions }, { quoted: m });
                    } else {
                        hari.forEach(p => {
                            if (data[sender][p].length > 0) {
                                isFound = true;
                                message += `📌 *${p.toUpperCase()}*\n`;

                                data[sender][p].sort((a, b) => {
                                    const timeA = a.Jam.split(' - ')[0].trim();
                                    const timeB = b.Jam.split(' - ')[0].trim();
                                    return timeA.localeCompare(timeB);
                                });

                                data[sender][p].forEach((jadwal) => {
                                    const pjMentions = jadwal.pj.map(pj => `@${pj.split('@')[0]}`).join(", ");
                                    message += `📖 *Mata Kuliah:* ${jadwal.matkul}\n`;
                                    message += `🏫 *Ruangan:* ${jadwal.ruangan}\n`;
                                    message += `🕒 *Jam:* ${jadwal.Jam} ( ${calculateSKS(jadwal.Jam)} SKS )\n`;
                                    message += `👤 *Penanggung Jawab:* ${pjMentions}\n\n`;
                                    mentions.push(...jadwal.pj);
                                });
                            }
                        });

                        if (!isFound) {
                            message = `*Jadwal belum diatur!* Gunakan perintah *!set-jadwal* untuk mengatur jadwal.`;
                        }
                        await sock.sendMessage(sender, { text: message, mentions: mentions }, { quoted: m });
                    }
                } catch (error) {
                    console.error('❌ Error:', error);
                    await sock.sendMessage(sender, { text: 'Terjadi kesalahan pada sistem. Coba lagi nanti!' }, { quoted: m });
                }
            break;
            case '!set-jadwal':
                if (!isAdmin) return sock.sendMessage(sender, { text: '*Hanya admin grup yang dapat menggunakan perintah ini!*' }, { quoted: m });
                if (args.length < 2) return sock.sendMessage(sender, { text: 'Masukkan parameter hari (Ex: *!set-jadwal minggu*)' }, {quoted: m});
                if (jadwal[sender]) {
                    if (!jadwal[sender].user.includes(m.key.participant)) return sock.sendMessage(sender, { text: `*Setting jadwal harus bergantian!* Tunggu @${jadwal[sender].user.split('@')[0]} untuk menyelesaikan.`, mentions: [jadwal[sender].user] }, { quoted: m })
                }
                try {
                    const hariInput = args[1]?.toLowerCase();
                    if (!hariInput || !hari.includes(hariInput)) return sock.sendMessage(sender, { text: '*Hari tidak valid!* Parameter hari:\n' + hari.join(', ') }, { quoted: m });
                    
                    const data = await checkData(sender);
                    let mentions = [];
                    let message = `*JADWAL MATA KULIAH HARI ${hariInput.toUpperCase()}*\n\n`;
                
                    if (data[sender] && data[sender][hariInput] && data[sender][hariInput].length > 0) {
                        jadwal[sender] = {
                            user: m.key.participant,
                            hari: hariInput,
                            status: 'VERIFIKASI',
                        };

                        data[sender][hariInput].sort((a, b) => {
                            const timeA = a.Jam.split(' - ')[0].trim();
                            const timeB = b.Jam.split(' - ')[0].trim();
                            return timeA.localeCompare(timeB);
                        });

                        data[sender][hariInput].forEach((jadwal) => {
                            const pjMentions = jadwal.pj.map(pj => `@${pj.split('@')[0]}`).join(", ");
                            message += `📖 *Mata Kuliah:* ${jadwal.matkul}\n`;
                            message += `🏫 *Ruangan:* ${jadwal.ruangan}\n`;
                            message += `🕒 *Jam:* ${jadwal.Jam} ( ${calculateSKS(jadwal.Jam)} SKS )\n`;
                            message += `👤 *Penanggung Jawab:* ${pjMentions}\n\n`;
                            mentions.push(...jadwal.pj);
                        });
                            message += `Memperbarui jadwal akan menghapus jadwal sebelumnya, apa kamu yakin? *(YA / BATAL / HAPUS)*`;
                        await sock.sendMessage(sender, { text: message, mentions: mentions }, { quoted: m });
                    } else {
                        jadwal[sender] = {
                            user: m.key.participant,
                            hari: hariInput,
                            status: 'SUBMIT',
                        };
                        
                        let message = `📖 *Mata Kuliah:* (Ex: Jaringan Komputer)\n`;
                            message += `🏫 *Ruangan:* (Ex: A10.01.14)\n`;
                            message += `🕒 *Jam:* (Ex: 07.00 - 09.30)\n`;
                            message += `👤 *Penanggung Jawab:* (Ex: @user @user)`;

                        const msg = await sock.sendMessage(sender, { text: message }, {quoted: m});
                        await sock.sendMessage(sender, { text: '*Lengkapi form diatas tanpa merubah detail form!*' }, {quoted: msg});
                    }
                } catch (error) {
                    console.error('❌ Error:', error);
                    await sock.sendMessage(sender, { text: 'Terjadi kesalahan pada sistem. Coba lagi nanti!' }, { quoted: m });
                }
            break;
            case '!reminder':
                try {
                    if (args.length < 3) return sock.sendMessage(sender, { text: 'Masukkan parameter tanggal dan jam (Ex: *!reminder 13/04/2025 08.00*)' }, { quoted: m });
                    
                    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(args[1]) || !/^\d{2}\.\d{2}$/.test(args[2])) {
                        return sock.sendMessage(sender, { text: '*Format tanggal atau jam salah!* (Ex: *!reminder 13/04/2025 08.00*)' }, { quoted: m });
                    }
                    
                    const now = moment().tz('Asia/Jakarta');
                    const reminderTime = moment.tz(`${args[1]} ${args[2]}`, 'DD/MM/YYYY HH.mm', 'Asia/Jakarta');
                    
                    if (reminderTime.isBefore(now)) {
                        return sock.sendMessage(sender, { text: '*Tanggal atau jam yang dimasukkan sudah berlalu!* Masukkan waktu yang valid.' }, { quoted: m });
                    }
                    
                    if (quotedMsg) {
                        const data = await checkData(sender);

                        data[sender]['reminder'].push({
                            user: m.key.participant,
                            create: now.format('DD/MM/YYYY HH:mm'),
                            deadline: reminderTime.format('DD/MM/YYYY HH:mm'),
                            pesan: quotedMsg
                        });
                        
                        const duration = moment.duration(reminderTime.diff(now));
                        const days = duration.days();
                        const hours = duration.hours();
                        const minutes = duration.minutes();
                        
                        let timeMsg = days > 0
                            ? `Akan datang dalam *${days} hari ${hours} jam lagi*`
                            : hours > 0
                                ? `Akan datang dalam *${hours} jam lagi*`
                                : `Akan datang dalam *${minutes} menit lagi*`;
                                
                        await fs.promises.writeFile(path, JSON.stringify(data, null, 2));
                        return await sock.sendMessage(sender, { text: `*Pesan reminder berhasil disimpan.* (${timeMsg})` }, { quoted: m });
                    }
                    
                    reminder[sender] = {
                        user: m.key.participant,
                        tanggal: args[1],
                        jam: args[2],
                        status: 'VERIFIKASI',
                    };
                    
                    await sock.sendMessage(sender, { text: `Kirim pesan untuk di reminder pada *tanggal ${args[1]}, jam ${args[2]}*` }, { quoted: m });
                } catch (error) {
                    console.error('❌ Error:', error);
                    await sock.sendMessage(sender, { text: 'Terjadi kesalahan pada sistem. Coba lagi nanti!' }, { quoted: m });
                }
            break; 
            case '!tagall':
                if (isGroup) {
                    const members = groupMetadata.participants;
                    const mentions = members.map(member => member.id);
                    
                    const textMessage = 'Hello everyone! 👋';

                    await sock.sendMessage(sender, {
                        text: textMessage,
                        mentions: mentions,
                    });
                } else {
                    await sock.sendMessage(sender, { text: 'This command can only be used in a group chat.' });
                }
            break;  

            default:
            if (jadwal.hasOwnProperty(sender) && jadwal[sender].user == m.key.participant && isGroup) {
                if (command?.toUpperCase() === 'YA') {
                    if (jadwal[sender]?.status === 'VERIFIKASI') {
                        try {
                            const data = JSON.parse(await fs.promises.readFile(path, 'utf8'));
                            
                            jadwal[sender].status = 'SUBMIT';
                            data[sender][jadwal[sender].hari] = [];
                    
                            let message = `📖 *Mata Kuliah:* (Ex: Jaringan Komputer)\n`;
                                message += `🏫 *Ruangan:* (Ex: A10.01.14)\n`;
                                message += `🕒 *Jam:* (Ex: 07.00 - 09.30)\n`;
                                message += `👤 *Penanggung Jawab:* (Ex: @user @user)`;
                                
                            await fs.promises.writeFile(path, JSON.stringify(data, null, 2));
                            const msg = await sock.sendMessage(sender, { text: message });
                            return await sock.sendMessage(sender, { text: '*Lengkapi form diatas tanpa merubah detail form!*' }, {quoted: msg});
                        } catch (error) {
                            console.error('❌ Error:', error);
                            return await sock.sendMessage(sender, { text: 'Terjadi kesalahan pada sistem. Coba lagi nanti!' }, { quoted: m });
                        }
                    } else if (jadwal[sender]?.status === 'SUKSES') {
                        jadwal[sender].status = 'SUBMIT';
                        let message = `📖 *Mata Kuliah:* (Ex: Jaringan Komputer)\n`;
                            message += `🏫 *Ruangan:* (Ex: A10.01.14)\n`;
                            message += `🕒 *Jam:* (Ex: 07.00 - 09.30)\n`;
                            message += `👤 *Penanggung Jawab:* (Ex: @user @user)`;
                        const msg = await sock.sendMessage(sender, { text: message });
                        return await sock.sendMessage(sender, { text: '*Lengkapi form diatas tanpa merubah detail form!*' }, {quoted: msg});
                    }
                } else if (jadwal[sender]?.status === 'VERIFIKASI' && command?.toUpperCase() === 'BATAL' || jadwal[sender]?.status === 'SUBMIT' && command?.toUpperCase() === 'BATAL') {
                    delete jadwal[sender];
                    return await sock.sendMessage(sender, { text: '*Perintah mengatur jadwal dibatalkan!*' }, { quoted: m });
                } else if (jadwal[sender]?.status === 'VERIFIKASI' && command?.toUpperCase() === 'HAPUS') {
                    try {
                        const data = await checkData(sender);

                        data[sender][jadwal[sender].hari] = [];
                        await fs.promises.writeFile(path, JSON.stringify(data, null, 2));
                        await sock.sendMessage(sender, { text: `*Mata kuliah hari ${jadwal[sender].hari.toLowerCase()} berhasil dihapus.*` }, { quoted: m });
                        delete jadwal[sender];
                        return;
                    } catch (error) {
                        console.error('❌ Error:', error);
                        return await sock.sendMessage(sender, { text: 'Terjadi kesalahan pada sistem. Coba lagi nanti!' }, { quoted: m });
                    }
                } else if (jadwal[sender]?.status === 'SUKSES' && command?.toUpperCase() === 'SELESAI') {
                    try {
                        const data = await checkData(sender);
                        let mentions = []
                        let message = `*JADWAL MATA KULIAH HARI ${jadwal[sender].hari.toUpperCase()}*\n\n`;

                        data[sender][jadwal[sender].hari].sort((a, b) => {
                            const timeA = a.Jam.split(' - ')[0].trim();
                            const timeB = b.Jam.split(' - ')[0].trim();
                            return timeA.localeCompare(timeB);
                        });

                        data[sender][jadwal[sender].hari].forEach((jadwal) => {
                            const pjMentions = jadwal.pj.map(pj => `@${pj.split('@')[0]}`).join(", ");
                            message += `📖 *Mata Kuliah:* ${jadwal.matkul}\n`;
                            message += `🏫 *Ruangan:* ${jadwal.ruangan}\n`;
                            message += `🕒 *Jam:* ${jadwal.Jam} ( ${calculateSKS(jadwal.Jam)} SKS )\n`;
                            message += `👤 *Penanggung Jawab:* ${pjMentions}\n\n`;
                            mentions.push(...jadwal.pj);
                        });
                        delete jadwal[sender];
                        return await sock.sendMessage(sender, { text: message, mentions: mentions }, { quoted: m });
                    } catch (error) {
                        console.error('❌ Error:', error);
                        return await sock.sendMessage(sender, { text: 'Terjadi kesalahan pada sistem. Coba lagi nanti!' }, { quoted: m });
                    }
                }

                if (jadwal[sender]?.status === 'SUBMIT') {
                    try {
                        const data = await checkData(sender);
                        const regex = /📖 Mata Kuliah:\s*(.+?)\s*🏫 Ruangan:\s*(.+?)\s*🕒 Jam:\s*(.+?)\s*👤 Penanggung Jawab:\s*(.+)/;
                        const match = command.replace(/\*/g, '').match(regex);
                
                        if (match) {
                            if (!/^\d{2}(\.\d{2})?\s*-\s*\d{2}(\.\d{2})?$/.test(match[3].trim())) {
                                return sock.sendMessage(sender, { text: '*Format Jam yang kamu masukkan salah!* (Ex: 07.00 - 09.30)' }, { quoted: m });
                            }
            
                            const mentionedJid = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                            const pj = mentionedJid.filter(jid => match[4]?.trim().includes('@' + jid.split('@')[0]));
                
                            if (pj.length === 0) {
                                msg = '*Penanggung Jawab harus mengandung mention!* (Ex: @6285645319608)';
                                return sock.sendMessage(sender, { text: msg, mentions: ['6285645319608@s.whatsapp.net'] }, { quoted: m });
                            }
                
                            data[sender][jadwal[sender].hari].push({
                                matkul: match[1].trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
                                ruangan: match[2].trim(),
                                Jam: match[3].trim().replace(/\s*-\s*/, ' - '),
                                pj: pj
                            });
                
                            jadwal[sender].status = 'SUKSES';
                            await fs.promises.writeFile(path, JSON.stringify(data, null, 2));
                            return await sock.sendMessage(sender, { text: `*MATA KULIAH ${match[1].trim().toUpperCase()} TELAH DITAMBAHKAN*\n\nIngin menambahkan mata kuliah lainnya? *(YA / SELESAI)*` }, { quoted: m });
                        } else {
                            return sock.sendMessage(sender, { text: '*Detail form tidak sesuai, gunakan detail form original!*' }, { quoted: m });
                        }
                    } catch (error) {
                        console.error('❌ Error:', error);
                        return await sock.sendMessage(sender, { text: 'Terjadi kesalahan pada sistem. Coba lagi nanti!' }, { quoted: m });
                    }
                }
            }                     
            if (reminder.hasOwnProperty(sender) && reminder[sender].user == m.key.participant && isGroup) {
                if (reminder[sender]?.status === 'VERIFIKASI') {
                    const now = moment().tz('Asia/Jakarta');
                    const reminderTime = moment.tz(`${reminder[sender]?.tanggal} ${reminder[sender]?.jam}`, 'DD/MM/YYYY HH:mm', 'Asia/Jakarta');
            
                    if (reminderTime.isBefore(now)) {
                        return sock.sendMessage(sender, { 
                            text: '*Waktu dengan yang disetting sudah berlalu!* Kirim ulang perintah dengan waktu yang valid.' 
                        }, { quoted: m });
                    }

                    try {
                        const data = await checkData(sender);

                        data[sender]['reminder'].push({
                            user: m.key.participant,
                            create: now.format('DD/MM/YYYY HH:mm'),
                            deadline: reminderTime.format('DD/MM/YYYY HH:mm'),
                            pesan: command
                        });
                
                        const duration = moment.duration(reminderTime.diff(now));
                        let timeMsg = 'Waktu sudah berlalu';
                        
                        if (duration.asMinutes() > 0) {
                            const days = duration.days();
                            const hours = duration.hours();
                            const minutes = duration.minutes();
                            timeMsg = days > 0
                                ? `Akan datang dalam *${days} hari ${hours} jam lagi*`
                                : hours > 0
                                    ? `Akan datang dalam *${hours} jam lagi*`
                                    : `Akan datang dalam *${minutes} menit lagi*`;
                        }
                
                        await fs.promises.writeFile(path, JSON.stringify(data, null, 2));
                        await sock.sendMessage(sender, { text: `*Pesan reminder berhasil disimpan.* (${timeMsg})` }, { quoted: m });
                        delete reminder[sender];
                        return;
                    } catch (error) {
                        console.error('❌ Error:', error);
                        return await sock.sendMessage(sender, { text: '❌ Terjadi kesalahan pada sistem. Coba lagi nanti!' }, { quoted: m });
                    }
                }                              
            }                 
        }
    }
};