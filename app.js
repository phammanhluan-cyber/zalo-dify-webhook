const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DIFY_API_KEY = process.env.DIFY_API_KEY;
const DIFY_API_URL = process.env.DIFY_API_URL || 'https://api.dify.ai/v1';

// Hàm lấy đường dẫn tải ảnh từ Telegram Bot API
async function getTelegramFileUrl(fileId) {
    const res = await axios.get(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
    const filePath = res.data.result.file_path;
    return `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;
}

app.post('/webhook', async (req, res) => {
    res.status(200).send('OK');

    const update = req.body;
    if (!update.message) return;

    const chatId = update.message.chat.id;
    let userMessage = update.message.text || update.message.caption || "Phân tích lỗi này giúp tôi";
    let filesArray = [];

    try {
        // Kiểm tra xem người dùng có gửi ảnh lên không
        if (update.message.photo && update.message.photo.length > 0) {
            // Lấy bức ảnh có độ phân giải cao nhất (phần tử cuối cùng trong mảng)
            const photo = update.message.photo[update.message.photo.length - 1];
            const fileUrl = await getTelegramFileUrl(photo.file_id);
            
            console.log(`Nhận được ảnh từ Telegram [ChatID: ${chatId}], URL: ${fileUrl}`);

            // Nếu Dify hỗ trợ upload file, ta tải ảnh và truyền vào inputs/files
            // Hoặc đính kèm URL ảnh vào câu hỏi để AI đọc
            filesArray = [{
                type: 'image',
                transfer_method: 'remote_url',
                url: fileUrl
            }];
        }

        console.log(`Xử lý yêu cầu từ [ChatID: ${chatId}]: ${userMessage}`);

        // Gửi sang Dify AI (hỗ trợ cả file ảnh nếu Dify App cho phép)
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

        // Gom dữ liệu trả về từ luồng stream của Dify
        let botReply = '';
        const lines = difyResponse.data.split('\n');
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                try {
                    const jsonData = JSON.parse(line.substring(6));
                    if (jsonData.answer) {
                        botReply += jsonData.answer;
                    }
                } catch (e) {}
            }
        }

        if (!botReply) {
            botReply = "Đã nhận ảnh nhưng hệ thống AI không trả về nội dung phân tích.";
        }

        // Gửi kết quả về Telegram
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: botReply
        });

    } catch (error) {
        console.error('Lỗi xử lý:', error.response?.data || error.message);
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: "Hệ thống gặp sự cố khi xử lý hình ảnh hoặc kết nối Dify. Anh kiểm tra lại định dạng app trên Dify nhé!"
        });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
