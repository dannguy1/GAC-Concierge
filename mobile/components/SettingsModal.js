import React, { useState } from 'react';
import {
    Modal, View, Text, TextInput, TouchableOpacity,
    StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { saveServerHost, getServerHost } from '../services/api';

export default function SettingsModal({ visible, onClose }) {
    const [host, setHost] = useState(getServerHost);
    const [status, setStatus] = useState('');
    const [testing, setTesting] = useState(false);

    const handleTest = async () => {
        setTesting(true);
        setStatus('');
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        try {
            const res = await fetch(`http://${host.trim()}/v1/health`, { signal: controller.signal });
            setStatus(res.ok ? '✅ Connected!' : `⚠️ Server responded with ${res.status}`);
        } catch (e) {
            setStatus(`❌ ${e.message || 'Could not reach server'}`);
        } finally {
            clearTimeout(timer);
            setTesting(false);
        }
    };

    const handleSave = async () => {
        await saveServerHost(host);
        onClose(true); // true = host changed, caller should reload menu
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={() => onClose(false)}>
            <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <View style={styles.sheet}>
                    <Text style={styles.title}>⚙️ Server Settings</Text>
                    <Text style={styles.label}>Backend Host  <Text style={styles.hint}>(IP:port)</Text></Text>
                    <TextInput
                        style={styles.input}
                        value={host}
                        onChangeText={v => { setHost(v); setStatus(''); }}
                        placeholder="192.168.1.100:8000"
                        placeholderTextColor="#aaa"
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                    />
                    <Text style={styles.example}>e.g. 192.168.10.3:8000</Text>

                    {!!status && <Text style={styles.status}>{status}</Text>}

                    <View style={styles.btnRow}>
                        <TouchableOpacity style={styles.btnSecondary} onPress={handleTest} disabled={testing}>
                            {testing
                                ? <ActivityIndicator color="#5a7a3a" />
                                : <Text style={styles.btnSecondaryText}>Test</Text>
                            }
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.btnPrimary} onPress={handleSave}>
                            <Text style={styles.btnPrimaryText}>Save &amp; Reconnect</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.cancelBtn} onPress={() => onClose(false)}>
                        <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
    title: { fontSize: 18, fontWeight: '700', color: '#2c2c2c', marginBottom: 20, textAlign: 'center' },
    label: { fontSize: 13, fontWeight: '700', color: '#555', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
    hint: { fontWeight: '400', textTransform: 'none', letterSpacing: 0, color: '#888' },
    input: { borderWidth: 1, borderColor: '#d0c8b8', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#2c2c2c', backgroundColor: '#faf8f2' },
    example: { fontSize: 12, color: '#aaa', marginTop: 5, marginBottom: 12 },
    status: { fontSize: 14, marginBottom: 12, textAlign: 'center' },
    btnRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    btnSecondary: { flex: 1, borderWidth: 1.5, borderColor: '#5a7a3a', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
    btnSecondaryText: { color: '#5a7a3a', fontWeight: '700', fontSize: 15 },
    btnPrimary: { flex: 2, backgroundColor: '#5a7a3a', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
    btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    cancelBtn: { alignItems: 'center', paddingVertical: 10 },
    cancelText: { color: '#aaa', fontSize: 14 },
});
