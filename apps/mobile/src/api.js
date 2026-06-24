import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');
const TIMEOUT_MS = 30000;
const MAX_RETRIES = 2;

async function getToken() {
  try { return await AsyncStorage.getItem('token'); } catch { return null; }
}

async function request(path, options = {}, attempt = 0) {
  const headers = Object.assign({}, options.headers || {});
  const token = await getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API_URL + path, Object.assign({}, options, { headers, signal: controller.signal }));
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    if (!res.ok) throw new Error((data && data.error) || res.statusText);
    return data;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Server did not respond in time, please try again');
    if (attempt < MAX_RETRIES && e.message !== 'Unauthorized') {
      await new Promise(r => setTimeout(r, 2000));
      return request(path, options, attempt + 1);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function attachmentUrl(id) {
  return API_URL + '/attachments/' + id + '?token=' + encodeURIComponent('');
}

function avatarUrl(userId) {
  return API_URL + '/users/' + userId + '/avatar?token=' + encodeURIComponent('');
}

function postImageUrl(id) {
  return API_URL + '/posts/' + id + '/image?token=' + encodeURIComponent('');
}

export const api = {
  register: (d) => request('/auth/register', { method: 'POST', body: JSON.stringify(d) }),
  login:    (d) => request('/auth/login',    { method: 'POST', body: JSON.stringify(d) }),
  me:       () => request('/me'),
  updateProfile: (d) => request('/auth/profile', { method: 'PUT', body: JSON.stringify(d) }),
  searchUsers: (q) => request('/users?q=' + encodeURIComponent(q)),
  listConversations: () => request('/conversations'),
  openConversation: (userId) =>
    request('/conversations', { method: 'POST', body: JSON.stringify({ userId: Number(userId) }) }),
  getMessages: (convId, opts) => {
    opts = opts || {};
    const limit = opts.limit || 50;
    const cursor = opts.cursor;
    const q = new URLSearchParams({ limit: String(limit) });
    if (cursor) q.set('cursor', String(cursor));
    return request('/conversations/' + convId + '/messages?' + q.toString());
  },
  sendMessage: (convId, payload) => {
    payload = payload || {};
    const fd = new FormData();
    if (payload.text) fd.append('text', payload.text);
    if (payload.image) fd.append('image', payload.image);
    return request('/conversations/' + convId + '/messages', { method: 'POST', body: fd });
  },
  markRead: (convId) => request('/conversations/' + convId + '/read', { method: 'POST' }),
  attachmentUrl,
  avatarUrl,
  uploadAvatar: (file) => {
    const fd = new FormData();
    fd.append('avatar', file);
    return request('/auth/avatar', { method: 'POST', body: fd });
  },
  deleteAvatar: () => request('/auth/avatar', { method: 'DELETE' }),
  getPosts: (opts) => {
    opts = opts || {};
    const q = new URLSearchParams();
    if (opts.limit) q.set('limit', String(opts.limit));
    if (opts.cursor) q.set('cursor', String(opts.cursor));
    return request('/posts?' + q.toString());
  },
  createPost: (payload) => {
    const fd = new FormData();
    if (payload.text) fd.append('text', payload.text);
    if (payload.image) fd.append('image', payload.image);
    return request('/posts', { method: 'POST', body: fd });
  },
  deletePost: (id) => request('/posts/' + id, { method: 'DELETE' }),
  postImageUrl,
  getComments: (postId) => request('/posts/' + postId + '/comments'),
  createComment: (postId, text) => request('/posts/' + postId + '/comments', { method: 'POST', body: JSON.stringify({ text }) }),
  deleteComment: (postId, commentId) => request('/posts/' + postId + '/comments/' + commentId, { method: 'DELETE' }),
  attachmentUrlWithToken: (id, token) => API_URL + '/attachments/' + id + '?token=' + encodeURIComponent(token),
  avatarUrlWithToken: (userId, token) => API_URL + '/users/' + userId + '/avatar?token=' + encodeURIComponent(token),
  postImageUrlWithToken: (id, token) => API_URL + '/posts/' + id + '/image?token=' + encodeURIComponent(token),
};
