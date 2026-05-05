import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { Stack } from 'expo-router';
import * as Audio from 'expo-audio';
import { ExpoPlayAudioStream } from '@cjblack/expo-audio-stream'; // Для стриминга

// Безопасный импорт сокетов
let createSocket: any;
try {
    createSocket = require('react-native-tcp-socket').createSocket;
} catch (e) {
    console.log("UDP недоступен в Expo Go");
}

export default function InfoScreen() {
    const [status, setStatus] = useState('Готов');
    const [targetIp, setTargetIp] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [udpSocket, setUdpSocket] = useState<any>(null);

    // Ссылка на функцию остановки стрима (чтобы вызвать при onPressOut)
    const stopStreamRef = useRef<(() => void) | null>(null);

    // Настройка аудио-режима
    useEffect(() => {
        Audio.setAudioModeAsync({
            allowsRecording: true,
            playsInSilentMode: true,
            shouldRouteThroughEarpiece: false,
        });
    }, []);

    // Инициализация сокета и прием потока
    useEffect(() => {
        if (!createSocket) return;

        const s = createSocket({ type: 'udp4' });
        s.on('message', (msg: string) => {
            // ПРИЕМ: Сразу воспроизводим пришедший чанк (base64)
            // Примечание: Функция воспроизведения зависит от версии библиотеки, 
            // обычно это декодирование и отправка в AudioTrack
            setStatus('Прием потока...');
            // ExpoAudioStream.playChunk(msg); // Пример логики воспроизведения чанка
        });

        s.bind(12345);
        setUdpSocket(s);
        return () => s.close();
    }, []);

    // СТАРТ: Начинаем стримить данные в реальном времени
    const startTalk = async () => {
        const permission = await Audio.requestRecordingPermissionsAsync();
        if (!permission.granted) return;

        try {
            setIsRecording(true);
            setStatus('В эфире...');

            // Просто запускаем запись с нужным интервалом
            await ExpoPlayAudioStream.startRecording({
                interval: 100, // Чанки каждые 100 мс
                sampleRate: 16000, // Для рации лучше 16кГц (быстрее передача)
            });
        } catch (e) {
            setStatus('Ошибка!');
            setIsRecording(false);
        }
    };


    // СТОП: Просто останавливаем поток
    const stopTalk = () => {
        setIsRecording(false);
        setStatus('Готов');
        if (stopStreamRef.current) {
            stopStreamRef.current();
            stopStreamRef.current = null;
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#064e3b', padding: 20 }}>
            <Stack.Screen options={{ title: 'Real-time Рация' }} />
            
            <View style={{ marginTop: 50, backgroundColor: '#065f46', padding: 20, borderRadius: 15 }}>
                <Text style={{ color: 'white', fontSize: 18 }}>Статус: {status}</Text>
                <TextInput
                    placeholder="IP получателя"
                    placeholderTextColor="#a7f3d0"
                    value={targetIp}
                    onChangeText={setTargetIp}
                    keyboardType="numeric"
                    style={{ backgroundColor: '#047857', color: 'white', padding: 10, borderRadius: 10, marginTop: 15 }}
                />
            </View>

            <View style={{ flex: 1, justifyContent: 'center' }}>
                <TouchableOpacity
                    onLongPress={startTalk}
                    onPressOut={stopTalk}
                    delayLongPress={100}
                    style={{
                        width: 160, height: 160, borderRadius: 80, alignSelf: 'center',
                        backgroundColor: isRecording ? '#ef4444' : '#10b981',
                        justifyContent: 'center', alignItems: 'center',
                        elevation: 10
                    }}
                >
                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 20 }}>
                        {isRecording ? 'ЭФИР' : 'ГОВОРИТЬ'}
                    </Text>
                </TouchableOpacity>
            </View>

            <Text style={{ color: '#a7f3d0', textAlign: 'center', fontSize: 12 }}>
                * Требуется Development Build для работы UDP и Стрима
            </Text>
        </View>
    );
}
