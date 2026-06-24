import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Image, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { getSocket } from '../socket';

function Avatar({ userId, name, hasAvatar, size = 32 }) {
  const { colors } = useTheme();
  if (hasAvatar) {
    return <Image source={{ uri: api.avatarUrlWithToken(userId, '') }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.primaryText, fontSize: size * 0.4, fontWeight: '600' }}>{(name || '?')[0].toUpperCase()}</Text>
    </View>
  );
}

export default function ChatViewScreen({ route, navigation }) {
  const { convId, other: otherParam } = route.params;
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [other, setOther] = useState(otherParam);
  const flatRef = useRef(null);
  const { colors } = useTheme();
  const { user } = useAuth();

  useEffect(() => {
    const sock = getSocket().then(s => {
      s.emit('joinConversation', convId);
      s.on('messageCreated', (msg) => {
        if (msg.conversationId !== convId) return;
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
      });
    });
    loadMessages();
    api.markRead(convId).catch(() => {});
    return () => {
      getSocket().then(s => s.off('messageCreated'));
    };
  }, [convId]);

  async function loadMessages() {
    try {
      const data = await api.getMessages(convId);
      setMessages(data.items);
      if (!other) {
        const list = await api.listConversations();
        const c = list.find(x => x.id === convId);
        if (c?.other) setOther(c.other);
      }
    } catch {}
  }

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 200);
    }
  }, [messages]);

  async function send() {
    if (!text.trim() && !pickedImage) return;
    setSending(true);
    try {
      const msg = await api.sendMessage(convId, { text: text.trim(), image: pickedImage || null });
      setMessages(prev => [...prev, msg]);
      setText('');
      setPickedImage(null);
      setPreview(null);
    } catch (e) { Alert.alert('Error', e.message); }
    setSending(false);
  }

  const [pickedImage, setPickedImage] = useState(null);
  const [preview, setPreview] = useState(null);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      const filename = uri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename);
      const mime = match ? `image/${match[1]}` : 'image/jpeg';
      setPickedImage({ uri, name: filename, type: mime });
      setPreview(uri);
    }
  }

  function renderMsg({ item: m }) {
    const isMine = m.authorId === user?.id;
    return (
      <View style={[styles.msg, { alignSelf: isMine ? 'flex-end' : 'flex-start' }]}>
        <View style={[styles.msgBubble, { backgroundColor: isMine ? colors.msgMine : colors.msgOther }]}>
          {!isMine && <Text style={[styles.msgAuthor, { color: colors.textSecondary }]}>{m.author?.name}</Text>}
          {m.text && <Text style={{ color: isMine ? colors.msgMineText : colors.msgOtherText }}>{m.text}</Text>}
          {m.attachments?.map(a => (
            <Image key={a.id} source={{ uri: api.attachmentUrlWithToken(a.id, '') }} style={styles.msgImage} resizeMode="cover" />
          ))}
          <Text style={[styles.msgTime, { color: isMine ? colors.msgMineText : colors.msgOtherText, opacity: 0.6 }]}>
            {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.bg }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 8 }}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        {other && <Avatar userId={other.id} name={other.name} hasAvatar={other.hasAvatar} size={32} />}
        <Text style={[styles.headerTitle, { color: colors.text, marginLeft: 8 }]}>{other?.name || 'Chat'}</Text>
      </View>

      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={m => String(m.id)}
        renderItem={renderMsg}
        style={{ flex: 1, paddingHorizontal: 12 }}
        contentContainerStyle={{ paddingVertical: 12 }}
      />

      {preview && (
        <View style={[styles.preview, { backgroundColor: colors.surface }]}>
          <Image source={{ uri: preview }} style={{ width: 60, height: 60, borderRadius: 8 }} />
          <TouchableOpacity onPress={() => { setPickedImage(null); setPreview(null); }} style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#e74c3c', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={14} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.composer, { borderTopColor: colors.border, backgroundColor: colors.bg }]}>
        <TouchableOpacity onPress={pickImage} style={styles.attachBtn}>
          <Ionicons name="camera-outline" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <TextInput
          style={[styles.textInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="Type a message..."
          placeholderTextColor={colors.textSecondary}
          value={text}
          onChangeText={setText}
          multiline
        />
        <TouchableOpacity onPress={send} disabled={sending || (!text.trim() && !pickedImage)} style={[styles.sendBtn, { backgroundColor: colors.primary }]}>
          <Ionicons name="send" size={18} color={colors.primaryText} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontWeight: '600', flex: 1 },
  msg: { marginBottom: 8, maxWidth: '80%' },
  msgBubble: { padding: 10, borderRadius: 14 },
  msgAuthor: { fontSize: 12, marginBottom: 2 },
  msgImage: { width: 200, height: 200, borderRadius: 8, marginTop: 6 },
  msgTime: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  preview: { padding: 8, marginHorizontal: 12, borderRadius: 8, alignSelf: 'flex-start', position: 'relative' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', padding: 8, borderTopWidth: 1 },
  attachBtn: { padding: 8 },
  textInput: { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, maxHeight: 100, borderWidth: 1, marginHorizontal: 6, fontSize: 15 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
