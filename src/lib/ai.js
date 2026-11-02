// Only completed, real replies become context for a later question.
export const AI_MESSAGE_LIMIT = 2000;
export const AI_VISIBLE_TURNS = 20;
export const AI_DEFAULT_DISCLAIMER = 'AI có thể nhầm. Hãy kiểm tra thông tin quan trọng với trung tâm; nội dung tập luyện cần được huấn luyện viên xem xét.';

export function aiHistory(turns) {
  const pairs = [];
  let remaining = 6000;
  for (const turn of [...turns].reverse()) {
    if (turn.state !== 'done' || !turn.answer?.trim()) continue;
    const question = String(turn.question).trim().slice(0, AI_MESSAGE_LIMIT);
    const answer = turn.answer.trim().slice(0, 2000);
    if (question.length + answer.length > remaining) break;
    pairs.unshift([{ role: 'user', content: question }, { role: 'assistant', content: answer }]);
    remaining -= question.length + answer.length;
    if (pairs.length === 3) break;
  }
  return pairs.flat();
}

export function aiReply(body) {
  const data = body?.data && typeof body.data === 'object' ? body.data : body;
  // An HTTP 200 containing an error message is not an assistant answer.
  const text = typeof data?.reply === 'string' && data.reply.trim()
    ? data.reply.trim()
    : typeof data?.suggestions === 'string' ? data.suggestions.trim() : '';
  if (!text) {
    const error = new Error('Chưa nhận được nội dung trả lời. Bạn có thể thử lại.');
    error.emptyAnswer = true;
    throw error;
  }
  return {
    text,
    disclaimer: typeof data.disclaimer === 'string' && data.disclaimer.trim() ? data.disclaimer.trim() : AI_DEFAULT_DISCLAIMER,
  };
}

export function aiErrorMessage(error) {
  if (error?.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.';
  if (error?.status === 403) return 'Tài khoản này chưa được cấp quyền sử dụng trợ lý AI.';
  if (error?.status === 429) return 'Bạn đang gửi quá nhiều câu hỏi. Vui lòng chờ một lát rồi thử lại.';
  if (error?.status === 503) {
    if (/hạn mức|quota|quá tải/i.test(error.message ?? '')) return 'Trợ lý AI đang bận. Vui lòng thử lại sau ít phút.';
    if (/quá lâu|timeout|timed out/i.test(error.message ?? '')) return 'Trợ lý AI phản hồi quá lâu. Bạn có thể thử lại.';
    return 'Trợ lý AI tạm thời chưa sẵn sàng. Vui lòng thử lại sau.';
  }
  if (error?.name === 'TimeoutError' || error?.timedOut || error?.timeout || /timeout|quá lâu/i.test(error?.message ?? '')) return 'Trợ lý AI phản hồi quá lâu. Bạn có thể thử lại.';
  if (error?.offline) return 'Chưa kết nối được máy chủ. Hãy kiểm tra mạng rồi thử lại.';
  if (error?.emptyAnswer) return error.message;
  if (error?.status === 400) return 'Câu hỏi chưa được chấp nhận. Hãy kiểm tra nội dung rồi gửi lại.';
  return 'Chưa nhận được phản hồi từ trợ lý AI. Bạn có thể thử lại sau.';
}