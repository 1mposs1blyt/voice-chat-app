import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { Stack } from 'expo-router';
import * as Audio from 'expo-audio'; // Импортируем всё для надежности

// ВНИМАНИЕ: В Expo Go это будет undefined. Добавляем проверку.
let createSocket: any;
try {
    createSocket = require('react-native-tcp-socket').createSocket;
} catch (e) {
    console.log("Нативные сокеты недоступны в Expo Go");
}

export default function InfoScreen() {
    const [status, setStatus] = useState('Готов');
    const [targetIp, setTargetIp] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [udpSocket, setUdpSocket] = useState<any>(null);

    // Хук для записи
    const recorder = Audio.useAudioRecorder(Audio.RecordingPresets.HIGH_QUALITY);

    useEffect(() => {
        if (!createSocket) {
            setStatus('Ошибка: Нативные сокеты недоступны');
            return;
        }

        try {
            const s = createSocket({ type: 'udp4' });
            s.on('message', (msg: any, rinfo: any) => {
                setStatus(`Звук от ${rinfo.address}`);
            });
            s.bind(12345);
            setUdpSocket(s);
        } catch (e) {
            console.log('Socket Init Error:', e);
        }

        return () => {
            if (udpSocket && udpSocket.close) udpSocket.close();
        };
    }, []);

    const startTalk = async () => {
        // Правильный запрос разрешений
        const permission = await Audio.requestRecordingPermissionsAsync();
        if (!permission.granted) {
            setStatus('Микрофон запрещен!');
            return;
        }

        try {
            setStatus('Запись...');
            setIsRecording(true);
            await recorder.prepareToRecordAsync();
            recorder.record();
        } catch (e) {
            console.error(e);
            setStatus('Ошибка старта');
        }
    };

    const stopTalk = async () => {
        if (!isRecording) return;
        
        setIsRecording(false);
        setStatus('Обработка...');
        try {
            await recorder.stop();
            const uri = recorder.uri; // Путь к файлу
            
            if (udpSocket && targetIp) {
                // ВАЖНО: Просто строку 'AUDIO_DATA' слать можно, 
                // но для реального звука нужно читать файл uri через expo-file-system
                udpSocket.send('AUDIO_DATA', 0, 10, 12345, targetIp, (err: any) => {
                    setStatus(err ? 'Ошибка сети' : 'Передано');
                });
            } else if (!createSocket) {
                setStatus('Файл записан (эмуляция сети)');
                console.log('Записано в:', uri);
            }
        } catch (e) {
            console.error('Stop Error:', e);
            setStatus('Ошибка стопа');
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#064e3b', padding: 20 }}>
            <Stack.Screen options={{ title: 'Рация' }} />

            <View style={{ marginTop: 50, backgroundColor: '#065f46', padding: 20, borderRadius: 15 }}>
                <Text style={{ color: 'white', fontSize: 18 }}>Статус: {status}</Text>
                {!createSocket && (
                    <Text style={{ color: '#fecaca', fontSize: 12 }}>
                        * Работает в режиме демо (нужен Development Build для UDP)
                    </Text>
                )}
                <TextInput
                    placeholder="IP получателя"
                    placeholderTextColor="#a7f3d0"
                    value={targetIp}
                    onChangeText={setTargetIp}
                    style={{
                        backgroundColor: '#047857', color: 'white', padding: 10,
                        borderRadius: 10, marginTop: 15
                    }}
                />
            </View>

            <View style={{ flex: 1, justifyContent: 'center' }}>
                <TouchableOpacity
                    onLongPress={startTalk}
                    onPressOut={stopTalk}
                    delayLongPress={100}
                    style={{
                        width: 150, height: 150, borderRadius: 75, alignSelf: 'center',
                        backgroundColor: isRecording ? '#ef4444' : '#10b981',
                        justifyContent: 'center', alignItems: 'center',
                        elevation: 5, shadowColor: '#000', shadowOpacity: 0.3
                    }}
                >
                    <Text style={{ color: 'white', fontWeight: 'bold' }}>
                        {isRecording ? 'ГОВОРЮ' : 'ЗАЖМИ'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
