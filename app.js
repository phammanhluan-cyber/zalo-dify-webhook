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
            const photo = update.message.photo[update.message.photo.length - 1];
            const fileUrl = await getTelegramFileUrl(photo.file_id);
            
            console.log(`Nhận được ảnh từ Telegram [ChatID: ${chatId}], URL: ${fileUrl}`);

            // Chuyển sang dạng tải file trực tiếp hoặc truyền remote_url an toàn
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
            response_mode: 'blocking', // Chuyển sang chế độ blocking để nhận kết quả trọn vẹn, ổn định hơn stream
            user: String(chatId)
        };

        if (filesArray.length > 0) {
            payload.files = filesArray;
        }

        const difyResponse = await axios.post(`${DIFY_API_URL}/chat-messages`, payload, {
            headers: {
                'Authorization': `Bearer ${DIFY_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        let botReply = '';
        if (difyResponse.data && difyResponse.data.answer) {
            botReply = difyResponse.data.answer;
        }

        if (!botReply) {
            botReply = "AI đã tiếp nhận nhưng chưa trả về nội dung text. Anh kiểm tra lại định dạng câu trả lời trên Dify nhé.";
        }

        // Gửi kết quả về Telegram (chia nhỏ nếu nội dung quá dài)
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: botReply
        });

    } catch (error) {
        console.error('Lỗi xử lý chi tiết:', error.response?.data || error.message);
        let errorMsg = "Hệ thống gặp sự cố khi xử lý hình ảnh hoặc kết nối Dify.";
        if (error.response?.data?.message) {
            errorMsg += ` Chi tiết: ${error.response.data.message}`;
        }
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: errorMsg
        });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
