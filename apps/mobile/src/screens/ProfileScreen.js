import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Image, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

function AvatarDisplay({ userId, name, hasAvatar }) {
  const { colors } = useTheme();
  if (hasAvatar) {
    return <Image source={{ uri: api.avatarUrlWithToken(userId, '') }} style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.surface }} />;
  }
  return (
    <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.primaryText, fontSize: 36, fontWeight: '600' }}>{(name || '?')[0].toUpperCase()}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const { colors } = useTheme();
  const { user, setUser } = useAuth();

  useEffect(() => {
    api.me().then(u => {
      setUser(u);
      setName(u.name);
    }).catch(() => {});
  }, []);

  async function handleAvatarUpload() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      const filename = uri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename);
      const mime = match ? `image/${match[1]}` : 'image/jpeg';
      try {
        await api.uploadAvatar({ uri, name: filename, type: mime });
        setUser({ ...user, hasAvatar: true });
        setMsg('Avatar updated');
        setTimeout(() => setMsg(''), 3000);
      } catch (e) { Alert.alert('Error', e.message); }
    }
  }

  async function handleDeleteAvatar() {
    try {
      await api.deleteAvatar();
      setUser({ ...user, hasAvatar: false });
      setMsg('Avatar removed');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { Alert.alert('Error', e.message); }
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const u = await api.updateProfile({ name: name.trim() });
      setUser(u);
      setMsg('Profile saved');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { Alert.alert('Error', e.message); }
    setSaving(false);
  }

  if (!user) return null;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.pageTitle, { color: colors.text }]}>Profile</Text>

      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={handleAvatarUpload}>
          <AvatarDisplay userId={user.id} name={user.name} hasAvatar={user.hasAvatar} />
          <View style={[styles.avatarOverlay, { backgroundColor: 'rgba(0,0,0,0.4)' }]}>
            <Ionicons name="camera" size={28} color="#fff" />
          </View>
        </TouchableOpacity>
        {user.hasAvatar && (
          <TouchableOpacity onPress={handleDeleteAvatar} style={{ marginTop: 8 }}>
            <Text style={{ color: '#e74c3c', fontSize: 13 }}>Remove avatar</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.form}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          value={user.email || ''}
          editable={false}
        />

        <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16 }]}>Name</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          value={name}
          onChangeText={setName}
        />

        <TouchableOpacity onPress={handleSave} disabled={saving || !name.trim()} style={[styles.saveBtn, { backgroundColor: colors.primary }]}>
          <Ionicons name="save-outline" size={18} color={colors.primaryText} style={{ marginRight: 6 }} />
          <Text style={{ color: colors.primaryText, fontWeight: '600' }}>{saving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      {msg ? <Text style={styles.successMsg}>{msg}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pageTitle: { fontSize: 20, fontWeight: '700', paddingHorizontal: 16, paddingVertical: 12 },
  avatarSection: { alignItems: 'center', marginVertical: 20 },
  avatarOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  form: { paddingHorizontal: 24 },
  label: { fontSize: 13, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 10, padding: 12, marginTop: 20 },
  successMsg: { textAlign: 'center', color: '#27ae60', marginTop: 12, fontSize: 14 },
});
