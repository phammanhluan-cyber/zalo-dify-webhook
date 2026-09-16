const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DIFY_API_KEY = process.env.DIFY_API_KEY;
const DIFY_API_URL = process.env.DIFY_API_URL || 'https://api.dify.ai/v1';

async function getTelegramFileUrl(fileId) {
    const res = await axios.get(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
    const filePath = res.data.result.file_path;
    return `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;
}

// Hàm chia nhỏ tin nhắn nếu vượt quá giới hạn của Telegram (4096 ký tự)
async function sendLongMessage(chatId, text) {
    const MAX_LENGTH = 4000;
    if (text.length <= MAX_LENGTH) {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: text
        });
    } else {
        for (let i = 0; i < text.length; i += MAX_LENGTH) {
            const chunk = text.substring(i, i + MAX_LENGTH);
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                chat_id: chatId,
                text: chunk
            });
        }
    }
}

app.post('/webhook', async (req, res) => {
    res.status(200).send('OK');

    const update = req.body;
    if (!update.message) return;

    const chatId = update.message.chat.id;
    let userMessage = update.message.text || update.message.caption || "Phân tích lỗi này giúp tôi";
    let filesArray = [];

    try {
        if (update.message.photo && update.message.photo.length > 0) {
            const photo = update.message.photo[update.message.photo.length - 1];
            const fileUrl = await getTelegramFileUrl(photo.file_id);
            
            filesArray = [{
                type: 'image',
                transfer_method: 'remote_url',
                url: fileUrl
            }];
        }

        console.log(`Xử lý yêu cầu từ [ChatID: ${chatId}]: ${userMessage}`);

        const payload = {
            inputs: {},
            query: userMessage,
            response_mode: 'streaming',
            user: String(chatId)
        };

        if (filesArray.length > 0) {
            payload.files = filesArray;
        }

        const difyResponse = await axios.post(`${DIFY_API_URL}/chat-messages`, payload, {
            headers: {
                'Authorization': `Bearer ${DIFY_API_KEY}`,
                'Content-Type': 'application/json'
            },
            responseType: 'text'
        });

        let botReply = '';
        const lines = difyResponse.data.split('\n');
        
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                try {
                    const jsonStr = line.substring(6).trim();
                    if (!jsonStr) continue;
                    const jsonData = JSON.parse(jsonStr);
                    
                    if (jsonData.answer) {
                        botReply += jsonData.answer;
                    } else if (jsonData.message) {
                        botReply += jsonData.message;
                    } else if (jsonData.text) {
                        botReply += jsonData.text;
                    }
                } catch (e) {}
            }
        }

        if (!botReply) {
            botReply = "Dify đã xử lý xong nhưng không có dữ liệu trả về.";
        }

        await sendLongMessage(chatId, botReply);

    } catch (error) {
        console.error('Lỗi xử lý chi tiết:', error.response?.data || error.message);
        let errorMsg = "Hệ thống gặp sự cố kết nối Dify hoặc mô hình đang quá tải (503). Anh vui lòng thử lại sau vài giây.";
        if (error.response?.data?.message) {
            errorMsg = `Lỗi từ Dify: ${error.response.data.message}`;
        }
        await sendLongMessage(chatId, errorMsg);
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
