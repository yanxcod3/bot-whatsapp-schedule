const fs = require('fs');
const moment = require('moment-timezone');
const Groq = require("groq-sdk");
const groq = new Groq({ apiKey: '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' });
const { text } = require('stream/consumers');
const { color, bgcolor } = require('./lib/color');

const path = './database/database.json';
let jadwal = {};
let tugas = {};
let reminder = {};

async function checkData(id) {
    if (!fs.existsSync(path)) {
        fs.writeFileSync(path, JSON.stringify({}, null, 2));
    }

    const data = JSON.parse(await fs.promises.readFile(path, 'utf8'));
    if (!data[id]) {
        data[id] = {
            "senin": [], "selasa": [], "rabu": [], "kamis": [], "jumat": [], "sabtu": [], "minggu": [], "tugas": [], "reminder": []
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

function randomID(data) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result;
    do {
        result = '#';
        for (let i = 0; i < 3; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    } while (data.some(task => task.id === result));
    return result;
}

module.exports = async function handleMessages(sock, message) {
    const m = message.messages[0];
    const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const sender = m.key.remoteJid;
    const isGroup = sender.endsWith('@g.us');
    const groupMetadata = isGroup ? await sock.groupMetadata(sender) : '';
    const admins = isGroup ? groupMetadata.participants.filter(participant => participant.admin === 'admin' || participant.admin === 'superadmin').map(admin => admin.id) : '';
    const isAdmin = admins.includes(m.key.participant)
    const command = m.message?.conversation || m.message?.extendedTextMessage?.text;
    const args = command?.toLowerCase().split(' ');
    
    const quotedMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage ? m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text : m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation;

    const hari = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];

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

        if (m.message && m.message.extendedTextMessage?.contextInfo?.mentionedJid?.includes(botNumber)) {
            try {
                let userMessage = command.replace(/@\S+/g, '').trim();
                if (!userMessage) userMessage = "Hai, deepseek";
                let fullMessage = quotedMsg ? `${quotedMsg}\nPerintah: "${userMessage}"` : userMessage;
        
                const response = await groq.chat.completions.create({
                    messages: [
                        { role: "system", content: "Gunakan bahasa Indonesia bila pertanyaan tidak meminta bahasa lain." },
                        { role: "user", content: fullMessage }
                    ],
                    model: "deepseek-r1-distill-llama-70b",
                    temperature: 0.8,
                    top_p: 0.9,
                    stream: false                    
                });
        
                await sock.sendMessage(sender, { 
                    text: response.choices?.[0]?.message?.content.replace(/###/g, '').replace(/\*\*/g, '*').replace(/<think>[\s\S]*?<\/think>/g, '').trim() || 
                    "Maaf, saya tidak bisa memberikan jawaban saat ini." 
                }, { quoted: m });
            } catch (error) {
                console.error('❌ Error:', error);
                await sock.sendMessage(sender, { text: '*Terjadi kesalahan pada sistem.* Coba lagi nanti!' }, { quoted: m });
            }
        }             

        if(!command) return
        switch (args[0]) {
            // case '!pin':
            //     if (!m.message?.extendedTextMessage?.contextInfo?.stanzaId) {
            //         return sock.sendMessage(sender, { text: '⚠️ Gunakan perintah ini dengan me-reply pesan yang ingin di-pin!' }, { quoted: m });
            //     }

            //     try {
            //         const quotedMsgKey = {
            //             fromMe: false, 
            //             id: m.message.extendedTextMessage.contextInfo.stanzaId,
            //             participant: m.message.extendedTextMessage.contextInfo.participant || sender,
            //             remoteJid: m.key.remoteJid
            //         };

            //         console.log('🔍 Debug: Memproses pin pesan dengan key:', quotedMsgKey);

            //         await sock.sendMessage(m.key.remoteJid, {
            //             pin: {
            //                 type: 1, // 1 = Pin, 0 = Unpin
            //                 time: 86400, // 24 jam
            //                 key: quotedMsgKey
            //             }
            //         });

            //         await sock.sendMessage(sender, { text: '📌 *Pesan berhasil di-pin selama 24 jam!*' }, { quoted: m });

            //     } catch (error) {
            //         console.error('❌ Error saat mem-pin pesan:', error);
            //         await sock.sendMessage(sender, { text: 'Terjadi kesalahan saat mem-pin pesan. Coba lagi nanti!' }, { quoted: m });
            //     }
            // break;

            // case '!unpin':
            //     if (!m.message?.extendedTextMessage?.contextInfo?.stanzaId) {
            //         return sock.sendMessage(sender, { text: '⚠️ *Gunakan perintah ini dengan me-reply pesan yang ingin di-unpin!*' }, { quoted: m });
            //     }

            //     try {
            //         const messageKey = {
            //             remoteJid: m.key.remoteJid,
            //             fromMe: false,
            //             id: m.message.extendedTextMessage.contextInfo.stanzaId,
            //             participant: m.message.extendedTextMessage.contextInfo.participant || sender
            //         };

            //         await sock.sendMessage(sender, {
            //             pin: {
            //                 type: 0, // Unpin message
            //                 key: messageKey
            //             }
            //         });

            //         await sock.sendMessage(sender, { text: '📌 *Pesan berhasil di-unpin!*' }, { quoted: m });
            //     } catch (error) {
            //         console.error('❌ Error saat meng-unpin pesan:', error);
            //         await sock.sendMessage(sender, { text: 'Terjadi kesalahan saat meng-unpin pesan. Coba lagi nanti!' }, { quoted: m });
            //     }
            // break;
            case '=>':
                await sock.sendMessage(sender, { text: JSON.stringify(m, null, 2) }, { quoted: m });
            break;
            case '!help':
                let message = `*List of Commands:*\n`;
                message += '• *!list-jadwal* - Melihat daftar jadwal mata kuliah\n';
                message += '• *!set-jadwal* - Menetapkan jadwal mata kuliah\n';
                message += '• *!list-tugas* - Melihat daftar tugas mata kuliah\n';
                message += '• *!set-tugas* - Menetapkan tugas mata kuliah\n';
                message += '• *!reminder* - Mengatur pesan pengingat\n\n';
                message += '*Ask to AI:*\nAjukan pertanyaanmu dengan me-mention *@whatsapp bot*';
                
                await sock.sendMessage(sender, { text: message }, { quoted: m });
            break;
            case '!list-jadwal':
                try {
                    const data = await checkData(sender);
                    let mentions = [];
                    let message = `*JADWAL MATA KULIAH ${groupMetadata.subject}*\n\n`;
                    const hariInput = args[1]?.toLowerCase();
                    
                    if (hariInput) {
                        if (!hari.includes(hariInput)) return sock.sendMessage(sender, { text: '*Hari tidak valid!* Parameter hari:\n' + hari.join(', ') }, { quoted: m });
                        if (data[sender][hariInput]?.length > 0) {
                            message += `📌 *${hariInput.toUpperCase()}*\n`;
                            data[sender][hariInput].sort((a, b) => a.jam.localeCompare(b.jam));
                            
                            data[sender][hariInput].forEach(jadwal => {
                                const pjMentions = jadwal.pj.map(pj => `@${pj.split('@')[0]}`).join(", ");
                                message += `📖 *Mata Kuliah:* ${jadwal.matkul}\n`;
                                message += `🏫 *Ruangan:* ${jadwal.ruangan}\n`;
                                message += `🕒 *Jam:* ${jadwal.jam} ( ${calculateSKS(jadwal.jam)} SKS )\n`;
                                message += `👤 *Penanggung Jawab:* ${pjMentions}\n\n`;
                                mentions.push(...jadwal.pj);
                            });
                        } else {
                            message = `*Jadwal belum diatur!* Gunakan perintah *!set-jadwal* untuk mengatur jadwal.`;
                        }
                    } else {
                        hari.forEach(p => {
                            if (data[sender][p]?.length > 0) {
                                message += `📌 *${p.toUpperCase()}*\n`;
                                data[sender][p].sort((a, b) => a.jam.localeCompare(b.jam));
                                
                                data[sender][p].forEach(jadwal => {
                                    const pjMentions = jadwal.pj.map(pj => `@${pj.split('@')[0]}`).join(", ");
                                    message += `📖 *Mata Kuliah:* ${jadwal.matkul}\n`;
                                    message += `🏫 *Ruangan:* ${jadwal.ruangan}\n`;
                                    message += `🕒 *Jam:* ${jadwal.jam} ( ${calculateSKS(jadwal.jam)} SKS )\n`;
                                    message += `👤 *Penanggung Jawab:* ${pjMentions}\n\n`;
                                    mentions.push(...jadwal.pj);
                                });
                            }
                        });
                        
                        if (!message.includes("📌")) {
                            message = `*Jadwal belum diatur!* Gunakan perintah *!set-jadwal* untuk mengatur jadwal.`;
                        }
                    }
                    
                    await sock.sendMessage(sender, { text: message, mentions: mentions }, { quoted: m });
                } catch (error) {
                    console.error('❌ Error:', error);
                    await sock.sendMessage(sender, { text: '*Terjadi kesalahan pada sistem.* Coba lagi nanti!' }, { quoted: m });
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
                            const timeA = a.jam.split(' - ')[0].trim();
                            const timeB = b.jam.split(' - ')[0].trim();
                            return timeA.localeCompare(timeB);
                        });

                        data[sender][hariInput].forEach((jadwal) => {
                            const pjMentions = jadwal.pj.map(pj => `@${pj.split('@')[0]}`).join(", ");
                            message += `📖 *Mata Kuliah:* ${jadwal.matkul}\n`;
                            message += `🏫 *Ruangan:* ${jadwal.ruangan}\n`;
                            message += `🕒 *Jam:* ${jadwal.jam} ( ${calculateSKS(jadwal.jam)} SKS )\n`;
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
                    await sock.sendMessage(sender, { text: '*Terjadi kesalahan pada sistem.* Coba lagi nanti!' }, { quoted: m });
                }
            break;
            case '!list-tugas':
                try {
                    const data = await checkData(sender);
                    let message = `*DAFTAR TUGAS KULIAH ${groupMetadata.subject}* (${data[sender]['tugas'].length})\n\n`;
                    
                    if (!data[sender] || !data[sender]['tugas'].length) {
                        message = "*Tugas tidak ada!* Gunakan perintah *!set-tugas* untuk mengatur tugas.";
                    } else {
                        const sortedTugas = data[sender]['tugas'].sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
                        
                        sortedTugas.forEach(tugas => {
                            const now = new Date();
                            const [datePart, timePart] = tugas.deadline.split(' ');
                            const [day, month, year] = datePart.split('/').map(Number);
                            const [hour, minute] = timePart.split(':').map(Number);
                            const dueDate = new Date(year, month - 1, day, hour, minute);

                            const diff = dueDate - now;
                            let remainingTime;

                            if (isNaN(dueDate.getTime())) {
                                remainingTime = "Format deadline tidak valid";
                            } else if (diff <= 0) {
                                remainingTime = "Sudah lewat";
                            } else {
                                const minutes = Math.floor(diff / (1000 * 60));
                                const hours = Math.floor(minutes / 60);
                                const days = Math.floor(hours / 24);
                                const weeks = Math.floor(days / 7);
                                const months = Math.floor(days / 30);
                            
                                if (months > 0) {
                                    remainingTime = `${months} bulan ${days % 30} hari lagi`;
                                } else if (weeks > 0) {
                                    remainingTime = `${weeks} minggu ${days % 7} hari lagi`;
                                } else if (days > 0) {
                                    remainingTime = `${days} hari ${hours % 24} jam lagi`;
                                } else if (hours > 0) {
                                    remainingTime = `${hours} jam ${minutes % 60} menit lagi`;
                                } else {
                                    remainingTime = `${minutes} menit lagi`;
                                }
                            }                            

                            message += `📖 *Mata Kuliah:* ${tugas.matkul} *${tugas.id}*\n`;
                            message += `⏳ *Deadline:* ${tugas.deadline} *~${remainingTime}*\n`;
                            message += `📝 *Deskripsi:* ${tugas.deskripsi}\n\n`;
                        });
                    }
                    
                    await sock.sendMessage(sender, { text: message }, { quoted: m });
                } catch (error) {
                    console.error('❌ Error:', error);
                    await sock.sendMessage(sender, { text: '*Terjadi kesalahan pada sistem.* Coba lagi nanti!' }, { quoted: m });
                }
            break;            
            case '!set-tugas':
                if (tugas[sender]) {
                    if (!tugas[sender].user.includes(m.key.participant)) return sock.sendMessage(sender, { text: `*Setting jadwal harus bergantian!* Tunggu @${jadwal[sender].user.split('@')[0]} untuk menyelesaikan.`, mentions: [jadwal[sender].user] }, { quoted: m })
                }
                try {
                    await checkData(sender);
                    
                    tugas[sender] = {
                        user: m.key.participant,
                        status: 'SUBMIT',
                    };
                    
                    let message = `📖 *Mata Kuliah:* (Ex: Jaringan Komputer)\n`;
                        message += `⏳ *Deadline:* (Ex: 13/04/2025 08.00)\n`;
                        message += `📝 *Deskripsi:* (Ex: Buat laporan tentang topologi jaringan dan presentasi slide)`;

                    const msg = await sock.sendMessage(sender, { text: message }, {quoted: m});
                    await sock.sendMessage(sender, { text: '*Lengkapi form diatas tanpa merubah detail form!*' }, {quoted: msg});
                } catch (error) {
                    console.error('❌ Error:', error);
                    await sock.sendMessage(sender, { text: '*Terjadi kesalahan pada sistem.* Coba lagi nanti!' }, { quoted: m });
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
                            chat: m,
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
                        chat: m,
                        tanggal: args[1],
                        jam: args[2],
                        status: 'VERIFIKASI',
                    };
                    
                    await sock.sendMessage(sender, { text: `Kirim pesan untuk di reminder pada *tanggal ${args[1]}, jam ${args[2]}*` }, { quoted: m });
                } catch (error) {
                    console.error('❌ Error:', error);
                    await sock.sendMessage(sender, { text: '*Terjadi kesalahan pada sistem.* Coba lagi nanti!' }, { quoted: m });
                }
            break; 
            case '!tagall':
                const members = groupMetadata.participants;
                const mentions = members.map(member => member.id);
                
                const textMessage = 'Hello *@everyone*! 👋';

                await sock.sendMessage(sender, { text: textMessage, mentions: mentions });
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
                            return await sock.sendMessage(sender, { text: '*Terjadi kesalahan pada sistem.* Coba lagi nanti!' }, { quoted: m });
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
                        return await sock.sendMessage(sender, { text: '*Terjadi kesalahan pada sistem.* Coba lagi nanti!' }, { quoted: m });
                    }
                } else if (jadwal[sender]?.status === 'SUKSES' && command?.toUpperCase() === 'SELESAI') {
                    try {
                        const data = await checkData(sender);
                        let mentions = []
                        let message = `*JADWAL MATA KULIAH HARI ${jadwal[sender].hari.toUpperCase()}*\n\n`;

                        data[sender][jadwal[sender].hari].sort((a, b) => {
                            const timeA = a.jam.split(' - ')[0].trim();
                            const timeB = b.jam.split(' - ')[0].trim();
                            return timeA.localeCompare(timeB);
                        });

                        data[sender][jadwal[sender].hari].forEach((jadwal) => {
                            const pjMentions = jadwal.pj.map(pj => `@${pj.split('@')[0]}`).join(", ");
                            message += `📖 *Mata Kuliah:* ${jadwal.matkul}\n`;
                            message += `🏫 *Ruangan:* ${jadwal.ruangan}\n`;
                            message += `🕒 *Jam:* ${jadwal.jam} ( ${calculateSKS(jadwal.jam)} SKS )\n`;
                            message += `👤 *Penanggung Jawab:* ${pjMentions}\n\n`;
                            mentions.push(...jadwal.pj);
                        });
                        delete jadwal[sender];
                        return await sock.sendMessage(sender, { text: message, mentions: mentions }, { quoted: m });
                    } catch (error) {
                        console.error('❌ Error:', error);
                        return await sock.sendMessage(sender, { text: '*Terjadi kesalahan pada sistem.* Coba lagi nanti!' }, { quoted: m });
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
                                jam: match[3].trim().replace(/\s*-\s*/, ' - '),
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
                        return await sock.sendMessage(sender, { text: '*Terjadi kesalahan pada sistem.* Coba lagi nanti!' }, { quoted: m });
                    }
                }
            }
            
            if (tugas.hasOwnProperty(sender) && tugas[sender].user == m.key.participant && isGroup) {
                if (command?.toUpperCase() === 'YA') {
                    if (tugas[sender]?.status === 'SUKSES') {
                        tugas[sender].status = 'SUBMIT';
                        let message = `📖 *Mata Kuliah:* (Ex: Jaringan Komputer)\n`;
                            message += `⏳ *Deadline:* (Ex: 13/04/2025 08.00)\n`;
                            message += `📝 *Deskripsi:* (Ex: Buat laporan tentang topologi jaringan dan presentasi slide)`;
                        const msg = await sock.sendMessage(sender, { text: message });
                        return await sock.sendMessage(sender, { text: '*Lengkapi form diatas tanpa merubah detail form!*' }, {quoted: msg});
                    }
                } else if (tugas[sender]?.status === 'SUKSES' && command?.toUpperCase() === 'SELESAI') {
                    try {
                        delete tugas[sender];
                        return await sock.sendMessage(sender, { text: '*Semoga harimu selalu menyenangkan :)*' }, { quoted: m });
                    } catch (error) {
                        console.error('❌ Error:', error);
                        return await sock.sendMessage(sender, { text: '*Terjadi kesalahan pada sistem.* Coba lagi nanti!' }, { quoted: m });
                    }
                }
                
                if (tugas[sender]?.status === 'SUBMIT') {
                    try {
                        const data = await checkData(sender);
                        const regex = /📖 Mata Kuliah:\s*(.+?)\s*⏳ Deadline:\s*(\d{2}\/\d{2}\/\d{4} \d{2}\.\d{2})\s*📝 Deskripsi:\s*(.+?)(?:\n|$)/;
                        const match = command.replace(/\*/g, '').match(regex);

                        if (match) {
                            const now = moment().tz('Asia/Jakarta');
                            const reminderTime = moment.tz(match[2], 'DD/MM/YYYY HH.mm', 'Asia/Jakarta');

                            if (reminderTime.isBefore(now)) {
                                return sock.sendMessage(sender, { text: '*Tanggal atau jam yang dimasukkan sudah berlalu!* Masukkan waktu yang valid.' }, { quoted: m });
                            }

                            const getID = await randomID(data[sender].tugas);
                
                            data[sender].tugas.push({
                                id: getID,
                                matkul: match[1].trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
                                deadline: reminderTime.format('DD/MM/YYYY HH:mm'),
                                deskripsi: match[3]
                            });
                
                            tugas[sender].status = 'SUKSES';
                            await fs.promises.writeFile(path, JSON.stringify(data, null, 2));
                            return await sock.sendMessage(sender, { text: `*TUGAS KULIAH ${match[1].trim().toUpperCase()} TELAH DITAMBAHKAN*\n\nIngin menambahkan tugas kuliah lainnya? *(YA / SELESAI)*` }, { quoted: m });
                        } else {
                            return sock.sendMessage(sender, { text: '*Detail form tidak sesuai, gunakan detail form original!*' }, { quoted: m });
                        }
                    } catch (error) {
                        console.error('❌ Error:', error);
                        return await sock.sendMessage(sender, { text: '*Terjadi kesalahan pada sistem.* Coba lagi nanti!' }, { quoted: m });
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
                            chat: reminder[sender]?.chat,
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
                        return await sock.sendMessage(sender, { text: '*Terjadi kesalahan pada sistem.* Coba lagi nanti!' }, { quoted: m });
                    }
                }                              
            }                 
        }
    }
};