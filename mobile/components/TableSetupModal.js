import React, { useState, useEffect } from 'react';
import {
    Modal, View, Text, TextInput, TouchableOpacity,
    StyleSheet, Platform, KeyboardAvoidingView,
} from 'react-native';

export default function TableSetupModal({ visible, tableNumber, guestCount, onSave, onClose }) {
    const [table, setTable] = useState('');
    const [guests, setGuests] = useState(1);

    useEffect(() => {
        if (visible) {
            setTable(tableNumber || '');
            setGuests(guestCount || 1);
        }
    }, [visible]);

    const adjustGuests = (delta) => {
        setGuests(prev => Math.max(1, Math.min(20, prev + delta)));
    };

    const handleSave = () => {
        onSave(table.trim(), guests);
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <KeyboardAvoidingView
                style={styles.overlay}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
                <View style={styles.sheet}>
                    <View style={styles.handle} />
                    <Text style={styles.title}>Table Setup</Text>

                    <Text style={styles.label}>Table Number</Text>
                    <TextInput
                        style={styles.input}
                        value={table}
                        onChangeText={setTable}
                        placeholder="e.g. 5 or B3"
                        placeholderTextColor="#aaa"
                        keyboardType="default"
                        autoFocus
                        returnKeyType="done"
                    />

                    <Text style={styles.label}>Number of Guests</Text>
                    <View style={styles.stepper}>
                        <TouchableOpacity style={styles.stepBtn} onPress={() => adjustGuests(-1)}>
                            <Text style={styles.stepBtnText}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.stepValue}>{guests}</Text>
                        <TouchableOpacity style={styles.stepBtn} onPress={() => adjustGuests(1)}>
                            <Text style={styles.stepBtnText}>+</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
                        <Text style={styles.saveBtnText}>Save</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
    handle: { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
    title: { fontSize: 18, fontWeight: '700', color: '#2c2c2c', marginBottom: 20, textAlign: 'center' },
    label: { fontSize: 13, fontWeight: '600', color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: { borderWidth: 1, borderColor: '#e0d8c8', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#2c2c2c', backgroundColor: '#faf8f2', marginBottom: 20 },
    stepper: { flexDirection: 'row', alignItems: 'center', marginBottom: 28 },
    stepBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#e0d8c8', alignItems: 'center', justifyContent: 'center', backgroundColor: '#faf8f2' },
    stepBtnText: { fontSize: 22, color: '#5a7a3a', lineHeight: 26 },
    stepValue: { flex: 1, textAlign: 'center', fontSize: 24, fontWeight: '700', color: '#2c2c2c' },
    saveBtn: { backgroundColor: '#5a7a3a', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    cancelBtn: { alignItems: 'center', paddingVertical: 8 },
    cancelBtnText: { color: '#888', fontSize: 15 },
});
