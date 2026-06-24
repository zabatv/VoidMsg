import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Image, Alert, RefreshControl, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

function Avatar({ userId, name, hasAvatar, size = 36 }) {
  const { colors } = useTheme();
  if (hasAvatar) return <Image source={{ uri: api.avatarUrlWithToken(userId, '') }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surface }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.primaryText, fontSize: size * 0.4, fontWeight: '600' }}>{(name || '?')[0].toUpperCase()}</Text>
    </View>
  );
}

function CommentsModal({ postId, visible, onClose }) {
  const [items, setItems] = useState([]);
  const [text, setText] = useState('');
  const { colors } = useTheme();
  const { user } = useAuth();

  useEffect(() => {
    if (visible) api.getComments(postId).then(setItems).catch(() => {});
  }, [postId, visible]);

  async function send() {
    if (!text.trim()) return;
    try {
      const c = await api.createComment(postId, text.trim());
      setItems(prev => [...prev, c]);
      setText('');
    } catch (e) { Alert.alert('Error', e.message); }
  }

  async function del(commentId) {
    try {
      await api.deleteComment(postId, commentId);
      setItems(prev => prev.filter(c => c.id !== commentId));
    } catch (e) { Alert.alert('Error', e.message); }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={[styles.commentHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.commentHeaderTitle, { color: colors.text }]}>Comments</Text>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
        </View>
        <FlatList
          data={items}
          keyExtractor={c => String(c.id)}
          renderItem={({ item: c }) => (
            <View style={[styles.commentItem, { borderBottomColor: colors.border }]}>
              <Avatar userId={c.author?.id} name={c.author?.name} hasAvatar={c.author?.hasAvatar} size={28} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{c.author?.name}</Text>
                <Text style={{ color: colors.text }}>{c.text}</Text>
              </View>
              {c.authorId === user?.id && (
                <TouchableOpacity onPress={() => del(c.id)}><Ionicons name="trash-outline" size={18} color="#e74c3c" /></TouchableOpacity>
              )}
            </View>
          )}
        />
        <View style={[styles.composer, { borderTopColor: colors.border }]}>
          <TextInput
            style={[styles.commentInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            placeholder="Write a comment..."
            placeholderTextColor={colors.textSecondary}
            value={text}
            onChangeText={setText}
          />
          <TouchableOpacity onPress={send} disabled={!text.trim()} style={[styles.sendBtn, { backgroundColor: colors.primary }]}>
            <Ionicons name="send" size={16} color={colors.primaryText} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function FeedScreen() {
  const [posts, setPosts] = useState([]);
  const [postText, setPostText] = useState('');
  const [postImage, setPostImage] = useState(null);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [feedErr, setFeedErr] = useState('');
  const [commentPostId, setCommentPostId] = useState(null);
  const { colors } = useTheme();
  const { user } = useAuth();

  useEffect(() => { load(); }, []);

  async function load() {
    setFeedErr('');
    try {
      const data = await api.getPosts({ limit: 30 });
      setPosts(data.items);
    } catch (e) {
      if (posts.length === 0) setFeedErr('Could not load posts — ' + e.message);
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, []);

  async function handlePost() {
    if (!postText.trim() && !postImage) return;
    setSending(true);
    try {
      const p = await api.createPost({ text: postText.trim(), image: postImage || undefined });
      setPosts(prev => [p, ...prev]);
      setPostText('');
      setPostImage(null);
    } catch (e) { Alert.alert('Error', e.message); }
    setSending(false);
  }

  async function handleDelete(id) {
    try {
      await api.deletePost(id);
      setPosts(prev => prev.filter(p => p.id !== id));
    } catch (e) { Alert.alert('Error', e.message); }
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      const filename = uri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename);
      const mime = match ? `image/${match[1]}` : 'image/jpeg';
      setPostImage({ uri, name: filename, type: mime });
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Feed</Text>
      </View>

      <FlatList
        data={posts}
        keyExtractor={p => String(p.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
        ListHeaderComponent={
          <View style={[styles.postForm, { borderBottomColor: colors.border }]}>
            <TextInput
              style={[styles.postInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="What's on your mind?"
              placeholderTextColor={colors.textSecondary}
              value={postText}
              onChangeText={setPostText}
              multiline
              maxLength={1000}
            />
            <View style={styles.postFooter}>
              <TouchableOpacity onPress={pickImage}>
                <Ionicons name="camera-outline" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handlePost} disabled={sending || (!postText.trim() && !postImage)} style={[styles.postBtn, { backgroundColor: colors.primary }]}>
                <Text style={{ color: colors.primaryText, fontWeight: '600' }}>{sending ? '...' : 'Post'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        renderItem={({ item: p }) => (
          <View style={[styles.feedItem, { borderBottomColor: colors.border }]}>
            <View style={styles.feedHeader}>
              <Avatar userId={p.author?.id} name={p.author?.name} hasAvatar={p.author?.hasAvatar} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>{p.author?.name}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{new Date(p.createdAt).toLocaleDateString()}</Text>
              </View>
              {p.authorId === user?.id && (
                <TouchableOpacity onPress={() => handleDelete(p.id)}><Ionicons name="trash-outline" size={18} color="#e74c3c" /></TouchableOpacity>
              )}
            </View>
            {p.text && <Text style={[styles.feedText, { color: colors.text }]}>{p.text}</Text>}
            {p.imageMimeType && (
              <Image source={{ uri: api.postImageUrlWithToken(p.id, '') }} style={styles.feedImage} resizeMode="contain" />
            )}
            <TouchableOpacity onPress={() => setCommentPostId(p.id)} style={styles.commentBtn}>
              <Ionicons name="chatbubble-outline" size={16} color={colors.textSecondary} style={{ marginRight: 4 }} />
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Comments</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          feedErr ? (
            <View style={styles.center}>
              <Text style={{ color: '#e74c3c', marginBottom: 8 }}>{feedErr}</Text>
              <TouchableOpacity onPress={load} style={[styles.retryBtn, { backgroundColor: colors.primary }]}>
                <Text style={{ color: colors.primaryText }}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={[styles.empty, { color: colors.textSecondary }]}>No posts yet. Be the first!</Text>
          )
        }
      />

      <CommentsModal postId={commentPostId} visible={!!commentPostId} onClose={() => setCommentPostId(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  postForm: { padding: 12, borderBottomWidth: 0.5 },
  postInput: { borderRadius: 10, borderWidth: 1, padding: 10, minHeight: 60, textAlignVertical: 'top', fontSize: 14 },
  postFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  postBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
  feedItem: { padding: 12, borderBottomWidth: 0.5 },
  feedHeader: { flexDirection: 'row', alignItems: 'center' },
  feedText: { marginTop: 8, fontSize: 14, lineHeight: 20 },
  feedImage: { width: '100%', height: 250, borderRadius: 8, marginTop: 8 },
  commentBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1 },
  commentHeaderTitle: { fontSize: 17, fontWeight: '600' },
  commentItem: { flexDirection: 'row', alignItems: 'flex-start', padding: 10, borderBottomWidth: 0.5 },
  composer: { flexDirection: 'row', alignItems: 'center', padding: 8, borderTopWidth: 1 },
  commentInput: { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, marginRight: 8, fontSize: 14 },
  sendBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', marginTop: 40 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14 },
});
