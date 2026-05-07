import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PermissionsAndroid, Platform } from 'react-native';
import dgram from 'react-native-udp';
import LiveAudioStream from 'react-native-live-audio-stream';
import { Buffer } from 'buffer';

const PORT = 12345;
const BROADCAST_ADDR = '255.255.255.255';

const VoiceChat = () => {
  const [socket, setSocket] = useState<any>(null);
  const [isTalking, setIsTalking] = useState(false);
  const [status, setStatus] = useState('Ожидание...');

  useEffect(() => {
    // 1. Инициализация UDP сокета
    const newSocket = dgram.createSocket({ type: 'udp4' });
    
    newSocket.bind(PORT, () => {
      newSocket.setBroadcast(true);
      setStatus('Готов к связи (LAN)');
    });

    // Слушаем входящий звук
    newSocket.on('message', (msg, rinfo) => {
      // Чтобы не слышать самого себя (проверка по IP не всегда надежна в Hotspot)
      // В идеале добавить ID устройства в начало пакета
      playAudioChunk(msg.toString('base64'));
    });

    setSocket(newSocket);

    // 2. Настройка микрофона
    LiveAudioStream.init({
      sampleRate: 8000,  // Низкое качество = высокая пробиваемость сети
      channels: 1,
      bitsPerSample: 16,
      audioSource: 7,    // Voice communication
      bufferSize: 1024,
    });

    // При получении данных с микрофона — сразу в сеть
    LiveAudioStream.on('data', (data) => {
      if (newSocket) {
        const chunk = Buffer.from(data, 'base64');
        newSocket.send(chunk, 0, chunk.length, PORT, BROADCAST_ADDR, (err) => {
          if (err) console.log('Ошибка отправки:', err);
        });
      }
    });

    return () => {
      newSocket.close();
      LiveAudioStream.stop();
    };
  }, []);

  const playAudioChunk = (base64Data: string) => {
    // Здесь логика воспроизведения. 
    // LiveAudioStream обычно только записывает. 
    // Для воспроизведения PCM потока в RN без WebRTC лучше всего 
    // использовать библиотеку react-native-pcm-player или аналоги.
  };

  const startTalking = () => {
    setIsTalking(true);
    LiveAudioStream.start();
    setStatus('ГОВОРИТЕ...');
  };

  const stopTalking = () => {
    setIsTalking(false);
    LiveAudioStream.stop();
    setStatus('СЛУШАЮ...');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.status}>{status}</Text>
      
      <TouchableOpacity 
        style={[styles.pttButton, isTalking && styles.pttButtonActive]}
        onPressIn={startTalking}
        onPressOut={stopTalking}
      >
        <Text style={styles.buttonText}>{isTalking ? 'ЭФИР' : 'НАЖМИ И ГОВОРИ'}</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>Работает через Wi-Fi Hotspot без интернета</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' },
  status: { color: '#fff', fontSize: 18, marginBottom: 50 },
  pttButton: {
    width: 200, height: 200, borderRadius: 100, backgroundColor: '#444',
    justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: '#666'
  },
  pttButtonActive: { backgroundColor: '#e74c3c', borderColor: '#ff6b6b' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 20 },
  hint: { color: '#666', marginTop: 30, textAlign: 'center', paddingHorizontal: 20 }
});

export default VoiceChat;
