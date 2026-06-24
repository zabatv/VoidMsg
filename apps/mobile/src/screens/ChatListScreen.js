import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Image, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

function Avatar({ userId, name, hasAvatar, size = 44 }) {
  const { colors } = useTheme();
  if (hasAvatar) {
    return <Image source={{ uri: api.avatarUrlWithToken(userId, '') }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surface }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.primaryText, fontSize: size * 0.4, fontWeight: '600' }}>{(name || '?')[0].toUpperCase()}</Text>
    </View>
  );
}

export default function ChatListScreen({ navigation }) {
  const [list, setList] = useState([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadErr, setLoadErr] = useState('');
  const { colors, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoadErr('');
    try {
      setList(await api.listConversations());
    } catch (e) {
      if (list.length === 0) setLoadErr('Could not load conversations — ' + e.message);
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (query.length >= 2) {
      const timer = setTimeout(async () => {
        setSearching(true);
        try { setResults(await api.searchUsers(query)); } catch {}
        setSearching(false);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setResults([]);
    }
  }, [query]);

  async function pickUser(user) {
    try {
      const conv = await api.openConversation(user.id);
      navigation.navigate('ChatView', { convId: conv.id, other: conv.other || user });
    } catch (e) { Alert.alert('Error', e.message); }
  }

  async function pickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      const filename = uri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename);
      const mime = match ? `image/${match[1]}` : 'image/jpeg';
      const file = { uri, name: filename, type: mime };
      try {
        await api.uploadAvatar(file);
        load();
      } catch (e) { Alert.alert('Error', e.message); }
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={pickAvatar}>
            <Avatar userId={user?.id} name={user?.name} hasAvatar={user?.hasAvatar} size={36} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{user?.name || 'Chats'}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={toggleTheme} style={styles.iconBtn}>
            <Ionicons name={colors.statusBar === 'light-content' ? 'moon' : 'sunny'} size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={styles.iconBtn}>
            <Ionicons name="log-out-outline" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search users..."
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
        />
        {searching && <Text style={{ color: colors.textSecondary }}>...</Text>}
      </View>

      {results.length > 0 && (
        <View style={[styles.searchResults, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {results.map(u => (
            <TouchableOpacity key={u.id} style={[styles.searchItem, { borderBottomColor: colors.border }]} onPress={() => pickUser(u)}>
              <Avatar userId={u.id} name={u.name} hasAvatar={u.hasAvatar} size={36} />
              <View style={{ marginLeft: 10 }}>
                <Text style={{ color: colors.text, fontWeight: '500' }}>{u.name}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{u.email}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loadErr ? (
        <View style={styles.center}>
          <Text style={{ color: '#e74c3c', marginBottom: 8 }}>{loadErr}</Text>
          <TouchableOpacity onPress={load} style={[styles.retryBtn, { backgroundColor: colors.primary }]}>
            <Text style={{ color: colors.primaryText }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={item => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.convItem, { borderBottomColor: colors.border }]} onPress={() => navigation.navigate('ChatView', { convId: item.id, other: item.other })}>
              <Avatar userId={item.other?.id} name={item.other?.name} hasAvatar={item.other?.hasAvatar} />
              <View style={styles.convInfo}>
                <Text style={[styles.convName, { color: colors.text }]}>{item.other?.name || 'Unknown'}</Text>
                <Text style={[styles.convLast, { color: colors.textSecondary }]}>
                  {item.lastMessage ? (item.lastMessage.attachments?.length > 0 ? '[Image]' : item.lastMessage.text || '') : '(no messages)'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.textSecondary }]}>No conversations yet — search for a user above</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  iconBtn: { padding: 6 },
  searchBox: { flexDirection: 'row', alignItems: 'center', margin: 12, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, height: 40 },
  searchInput: { flex: 1, fontSize: 15 },
  searchResults: { position: 'absolute', top: 140, left: 12, right: 12, borderRadius: 10, borderWidth: 1, zIndex: 100, maxHeight: 300 },
  searchItem: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
  convItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5 },
  convInfo: { flex: 1, marginLeft: 12 },
  convName: { fontSize: 16, fontWeight: '500' },
  convLast: { fontSize: 13, marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14 },
});
