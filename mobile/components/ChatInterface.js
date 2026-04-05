import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, FlatList,
    StyleSheet, ActivityIndicator, KeyboardAvoidingView,
    Platform, useWindowDimensions,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Audio } from 'expo-av';
import { fetchTTS } from '../services/api';

const LANGUAGES = [
    { label: '🇬🇧 English', value: 'English' },
    { label: '🇪🇸 Spanish', value: 'Spanish' },
    { label: '🇻🇳 Vietnamese', value: 'Vietnamese' },
    { label: '🇨🇳 Chinese', value: 'Mandarin Chinese' },
    { label: '🇫🇷 French', value: 'French' },
    { label: '🇮🇹 Italian', value: 'Italian' },
    { label: '🇧🇷 Portuguese', value: 'Portuguese' },
    { label: '🇮🇳 Hindi', value: 'Hindi' },
    { label: '🇯🇵 Japanese', value: 'Japanese' },
];

export default function ChatInterface({ messages, onSendMessage, isLoading, thinkingSeconds, onCancel, language, setLanguage }) {
    const [input, setInput] = useState('');
    const [playingIdx, setPlayingIdx] = useState(null);
    const flatListRef = useRef(null);
    const { width, height } = useWindowDimensions();
    const isLandscape = width > height;

    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
    }, [messages]);

    const handleSubmit = () => {
        if (!input.trim() || isLoading) return;
        onSendMessage(input.trim());
        setInput('');
    };

    const playTTS = async (text, msgLanguage, idx) => {
        setPlayingIdx(idx);
        try {
            const data = await fetchTTS(text, msgLanguage || language);
            if (!data.audio_base64) return;

            await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
            const { sound } = await Audio.Sound.createAsync(
                { uri: `data:audio/wav;base64,${data.audio_base64}` },
                { shouldPlay: true }
            );
            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.didJustFinish) {
                    setPlayingIdx(null);
                    sound.unloadAsync();
                }
            });
        } catch (e) {
            console.error('TTS Error:', e);
            setPlayingIdx(null);
        }
    };

    const visibleMessages = messages.filter(m => m.role !== 'system' && !m.hidden);

    const renderMessage = ({ item: msg, index }) => {
        const isUser = msg.role === 'user';
        return (
            <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
                <Text style={styles.bubbleRole}>{isUser ? 'GUEST' : 'CONCIERGE'}</Text>
                <Text style={styles.bubbleText}>{msg.content}</Text>
                {!isUser && (
                    <TouchableOpacity
                        onPress={() => playTTS(msg.content, msg.language, index)}
                        disabled={playingIdx !== null}
                        style={styles.ttsBtn}
                    >
                        <Text style={[styles.ttsBtnText, playingIdx !== null && playingIdx !== index && { opacity: 0.4 }]}>
                            {playingIdx === index ? '🔊 Playing...' : '▶ Play Voice'}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={isLandscape ? 20 : 90}
        >
            {/* Language picker — same height in both orientations */}
            <View style={styles.pickerRow}>
                <Picker
                    selectedValue={language}
                    onValueChange={setLanguage}
                    style={styles.picker}
                    mode="dropdown"
                >
                    {LANGUAGES.map(l => <Picker.Item key={l.value} label={l.label} value={l.value} />)}
                </Picker>
            </View>

            {/* Message list */}
            <FlatList
                ref={flatListRef}
                data={visibleMessages}
                keyExtractor={(_, i) => String(i)}
                renderItem={renderMessage}
                contentContainerStyle={styles.messageList}
                ListEmptyComponent={
                    <Text style={styles.emptyText}>"Welcome to Garlic &amp; Chives. How may I assist you today?"</Text>
                }
            />

            {/* Thinking indicator */}
            {isLoading && (
                <View style={styles.thinkingRow}>
                    <ActivityIndicator size="small" color="#5a7a3a" />
                    <Text style={styles.thinkingText}>
                        {thinkingSeconds < 15
                            ? `Drafting response${thinkingSeconds > 4 ? ` (${thinkingSeconds}s)` : ''}...`
                            : `Kristin is taking a moment... (${thinkingSeconds}s)`}
                    </Text>
                    {thinkingSeconds >= 20 && (
                        <TouchableOpacity onPress={onCancel}>
                            <Text style={styles.cancelBtn}>Cancel</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* Input bar */}
            <View style={styles.inputRow}>
                <TextInput
                    style={styles.input}
                    value={input}
                    onChangeText={setInput}
                    placeholder="Type your question or order..."
                    placeholderTextColor="#999"
                    editable={!isLoading}
                    onSubmitEditing={handleSubmit}
                    returnKeyType="send"
                    multiline
                />
                <TouchableOpacity
                    style={[styles.sendBtn, isLoading && styles.sendBtnDisabled]}
                    onPress={handleSubmit}
                    disabled={isLoading}
                >
                    <Text style={styles.sendBtnText}>Send</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#faf8f2' },
    pickerRow: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0d8c8', height: 56, justifyContent: 'center' },
    picker: { height: 56 },
    messageList: { padding: 16, paddingBottom: 8, flexGrow: 1 },
    emptyText: { textAlign: 'center', color: '#888', fontStyle: 'italic', marginTop: 40, fontSize: 15, lineHeight: 24 },
    bubble: { maxWidth: '85%', padding: 14, borderRadius: 14, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
    userBubble: { alignSelf: 'flex-end', backgroundColor: '#f0ece1', borderBottomRightRadius: 2 },
    assistantBubble: { alignSelf: 'flex-start', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0d8c8', borderBottomLeftRadius: 2 },
    bubbleRole: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4, color: '#5a7a3a', textTransform: 'uppercase' },
    bubbleText: { fontSize: 15, color: '#2c2c2c', lineHeight: 22 },
    ttsBtn: { marginTop: 8 },
    ttsBtnText: { fontSize: 12, color: '#c8a84b', textDecorationLine: 'underline', fontWeight: '600' },
    thinkingRow: { flexDirection: 'row', alignItems: 'center', padding: 10, paddingHorizontal: 16, gap: 8 },
    thinkingText: { color: '#888', fontStyle: 'italic', fontSize: 13, flex: 1 },
    cancelBtn: { color: '#c8a84b', fontSize: 13, textDecorationLine: 'underline', fontWeight: '600' },
    inputRow: { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderTopColor: '#e0d8c8', backgroundColor: '#fff', gap: 10, alignItems: 'flex-end' },
    input: { flex: 1, backgroundColor: '#faf8f2', borderWidth: 1, borderColor: '#e0d8c8', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100, color: '#2c2c2c' },
    sendBtn: { backgroundColor: '#5a7a3a', borderRadius: 24, paddingHorizontal: 20, paddingVertical: 12 },
    sendBtnDisabled: { opacity: 0.6 },
    sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
