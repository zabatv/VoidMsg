import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';

const themes = [
  { id: 'dark', label: 'Dark', icon: 'moon' },
  { id: 'light', label: 'Light', icon: 'sunny' },
];

export default function SettingsScreen() {
  const { colors, toggleTheme, themeId } = useTheme();

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.pageTitle, { color: colors.text }]}>Settings</Text>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Theme</Text>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
          {themes.map(t => (
            <TouchableOpacity
              key={t.id}
              onPress={() => { if (t.id !== themeId) toggleTheme(); }}
              style={[
                styles.themeCard,
                { backgroundColor: colors.surface, borderColor: themeId === t.id ? colors.primary : colors.border }
              ]}
            >
              <Ionicons name={t.icon} size={28} color={themeId === t.id ? colors.primary : colors.textSecondary} />
              <Text style={{ color: themeId === t.id ? colors.primary : colors.text, marginTop: 6, fontWeight: '500' }}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>About</Text>
        <Text style={[styles.aboutText, { color: colors.text }]}>VoidMsg v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pageTitle: { fontSize: 20, fontWeight: '700', paddingHorizontal: 16, paddingVertical: 12 },
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  themeCard: { flex: 1, alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 2 },
  aboutText: { fontSize: 14, marginTop: 8 },
});
