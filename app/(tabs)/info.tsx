import React, { useEffect, useState } from 'react';
import { View, Text, PermissionsAndroid, Platform, ScrollView, TouchableOpacity } from 'react-native';
import * as WifiP2P from 'react-native-wifi-p2p';
import dgram from 'react-native-udp';
import { useAudioRecorder, AudioModule } from 'expo-audio'; // Изменил импорты
import { Stack } from 'expo-router';

export default function InfoScreen() {
	const [devices, setDevices] = useState<any[]>([]);
	const [statusText, setStatusText] = useState('Ожидание...');
	const [isRecording, setIsRecording] = useState(false);
	const [socket, setSocket] = useState<any>(null);

	// Инициализация рекордера из нового API expo-audio
	const audioRecorder = useAudioRecorder();

	useEffect(() => {
		if (WifiP2P && typeof WifiP2P.initialize === 'function') {
			setupP2P();
		} else {
			setStatusText('Ошибка: Модуль P2P не найден');
		}

		setupSocket();

		return () => {
			if (WifiP2P && typeof WifiP2P.stopDiscoveringPeers === 'function') {
				WifiP2P.stopDiscoveringPeers();
			}
		};
	}, []);

	const setupP2P = async () => {
		try {
			await WifiP2P.initialize();
			let granted = false;
			if (Platform.OS === 'android') {
				const permissions = [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
				if (Platform.Version >= 33) {
					permissions.push(PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES);
				}
				const result = await PermissionsAndroid.requestMultiple(permissions);
				granted = result['android.permission.ACCESS_FINE_LOCATION'] === 'granted';
			}

			if (granted) {
				WifiP2P.subscribeOnPeersUpdates(({ devices }: { devices: any[] }) => {
					setDevices(devices);
				});
				startDiscovery();
			} else {
				setStatusText('Нет прав на геолокацию/WiFi');
			}
		} catch (err) {
			console.error('P2P Init Error:', err);
			setStatusText('Ошибка инициализации P2P');
		}
	};

	const startDiscovery = () => {
		setStatusText('Поиск устройств...');
		if (WifiP2P?.startDiscoveringPeers) {
			WifiP2P.startDiscoveringPeers()
			.then(() => console.log('Поиск запущен'))
			.catch(err => console.error(err));
		}
	};

	const connectToDevice = (device: any) => {
		if (WifiP2P && WifiP2P.connect) {
			WifiP2P.connect(device.deviceAddress)
				.then(() => setStatusText(`Подключено к ${device.deviceName}`))
				.catch(err => console.error(err));
		}
	};

	const setupSocket = () => {
		try {
			if (dgram && dgram.createSocket) {
				const s = dgram.createSocket({ type: 'udp4' });
				s.bind(12345);
				s.on('message', (msg, rinfo) => {
					console.log('Получен пакет');
				});
				setSocket(s);
			}
		} catch (err) {
			console.error('Socket error:', err);
		}
	};

	const startChat = async () => {
		// Проверка прав через AudioModule (новый API)
		const permission = await AudioModule.requestRecordingPermissionsAsync();
		if (!permission.granted) {
			setStatusText('Нет прав на микрофон');
			return;
		}

		try {
			setIsRecording(true);
			setStatusText('Говорю...');

			// Настройка и запуск записи (пример для expo-audio)
			await audioRecorder.prepareRecording({
				encoder: 'aac',
				sampleRate: 44100,
				bitRate: 128000,
				numberOfChannels: 1,
			});
			audioRecorder.record();

		} catch (err) {
			console.error(err);
			setStatusText('Ошибка записи');
			setIsRecording(false);
		}
	};

	const stopChat = async () => {
		setIsRecording(false);
		setStatusText('Подключен');
		if (audioRecorder.isRecording) {
			await audioRecorder.stop();
			console.log('Запись остановлена, файл в:', audioRecorder.uri);
			// Здесь будет логика отправки файла через сокет
		}
	};

	return (
		<>
			<Stack.Screen options={{ title: 'WiFi Voice Chat' }} />
			<View style={{ flex: 1, backgroundColor: '#064e3b', padding: 24 }}>
				<View style={{ marginTop: 40, padding: 16, backgroundColor: '#065f46', borderRadius: 16 }}>
					<Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18, marginBottom: 8 }}>
						Статус: {statusText}
					</Text>
					<TouchableOpacity
						onPress={startDiscovery}
						style={{ backgroundColor: '#059669', padding: 12, borderRadius: 12 }}
					>
						<Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>Обновить список</Text>
					</TouchableOpacity>
				</View>

				<ScrollView style={{ flex: 1, marginTop: 16 }}>
					<Text style={{ color: '#a7f3d0', marginBottom: 8, fontSize: 12, fontWeight: 'bold' }}>
						ДОСТУПНЫЕ УСТРОЙСТВА:
					</Text>
					{devices.length > 0 ? (
						devices.map((device, i) => (
							<TouchableOpacity
								key={i}
								onPress={() => connectToDevice(device)}
								style={{ backgroundColor: 'rgba(4, 120, 87, 0.5)', padding: 16, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#059669' }}
							>
								<Text style={{ color: 'white', fontWeight: '600' }}>{device.deviceName || 'Неизвестно'}</Text>
								<Text style={{ color: '#6ee7b7', fontSize: 12 }}>{device.deviceAddress}</Text>
							</TouchableOpacity>
						))
					) : (
						<Text style={{ color: '#059669', textAlign: 'center', marginTop: 20 }}>Устройств не найдено</Text>
					)}
				</ScrollView>

				<View style={{ paddingBottom: 40 }}>
					<TouchableOpacity
						onLongPress={startChat}
						onPressOut={stopChat}
						activeOpacity={0.7}
						style={{
							width: 96, height: 96, borderRadius: 48, alignSelf: 'center',
							alignItems: 'center', justifyContent: 'center',
							elevation: 5,
							backgroundColor: isRecording ? '#ef4444' : '#10b981'
						}}
					>
						<Text style={{ color: 'white', fontWeight: '900', textAlign: 'center' }}>
							{isRecording ? 'ГОВОРЮ' : 'ЗАЖМИ\nИ ГОВОРИ'}
						</Text>
					</TouchableOpacity>
				</View>
			</View>
		</>
	);
}
