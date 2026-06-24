import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../api';

const { width, height } = Dimensions.get('window');

function Particle({ index }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 3000 + Math.random() * 4000, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 3000 + Math.random() * 4000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const size = 2 + Math.random() * 4;
  const x = Math.random() * width;
  const y = Math.random() * height;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: 'rgba(139, 92, 246, 0.6)',
        opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.8] }),
        transform: [{
          translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -30] }),
        }],
      }}
    />
  );
}

function Particles() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: 20 }).map((_, i) => <Particle key={i} index={i} />)}
    </View>
  );
}

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const { login } = useAuth();
  const { colors } = useTheme();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();
  }, []);

  async function handleSubmit() {
    setLoading(true);
    try {
      const data = await api.login({ email, password });
      await login(data);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
    setLoading(false);
  }

  return (
    <LinearGradient colors={['#0f0c29', '#1a1a3e', '#24243e']} style={styles.container}>
      <Particles />
      <KeyboardAvoidingView style={styles.inner} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.logoSection}>
            <View style={styles.logoWrapper}>
              <LinearGradient colors={['#8b5cf6', '#6366f1']} style={styles.logoGlow}>
                <Ionicons name="chatbubbles" size={40} color="#fff" />
              </LinearGradient>
            </View>
            <Text style={styles.title}>VoidMsg</Text>
            <Text style={styles.subtitle}>Enter the void</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Ionicons name="mail-outline" size={18} color="#8b5cf6" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputGroup}>
              <Ionicons name="lock-closed-outline" size={18} color="#8b5cf6" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
              />
              <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              <LinearGradient colors={['#8b5cf6', '#6366f1']} style={styles.loginBtnGradient}>
                <Text style={styles.loginBtnText}>{loading ? 'Entering...' : 'Enter'}</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.linkBtn}>
              <Text style={styles.linkText}>No account? <Text style={styles.linkHighlight}>Create one</Text></Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
    padding: 28,
    backdropFilter: 'blur(20px)',
  },
  logoSection: { alignItems: 'center', marginBottom: 36 },
  logoWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  logoGlow: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: 2 },
  subtitle: { fontSize: 13, color: 'rgba(139, 92, 246, 0.7)', marginTop: 4, letterSpacing: 4, textTransform: 'uppercase' },
  form: { gap: 16 },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: 14,
    height: 50,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: '#fff', fontSize: 15, height: 50 },
  eyeBtn: { padding: 4 },
  loginBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 8 },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnGradient: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  linkBtn: { alignItems: 'center', marginTop: 16 },
  linkText: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  linkHighlight: { color: '#8b5cf6', fontWeight: '600' },
});
