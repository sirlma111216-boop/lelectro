# 센서 연결 문서 — Vernier Go Direct SDK 통합

이 문서는 앱이 사용하는 `@vernier/godirect` **1.8.3** (npm, BSD-3-Clause) 의 실제 소스를 읽고 확인한 내용과,
앱이 그 위에 어떻게 어댑터를 올렸는지 적는다. 실물 장치로 아직 확인하지 못한 항목은 마지막 절에 따로 모았다.

- 패키지: `@vernier/godirect@1.8.3` (package-lock.json 으로 고정, 번들에 포함. CDN latest 의존 없음)
- 저장소: https://github.com/VernierST/godirect-js
- 확인한 파일: `src/godirect.js`, `src/Device.js`, `src/Sensor.js`, `src/WebBluetoothDeviceAdapter.js`, `src/utils.js`, `src/constants.js`, `types/*.d.ts`, `dist/godirect.min.esm.js`
- 패키지의 `types/*.d.ts` 는 대부분 `any` 이고 `exports` 에 types 조건이 없어 번들 진입점에 연결되지 않는다. 앱은 소스를 보고 좁게 적은 타입(`src/sensors/godirectTypes.ts`)으로 캐스팅해 쓴다 (`src/types/vernier-godirect.d.ts`).
- 공식 예제(https://github.com/VernierST/godirect-examples, javascript/gdx_getting_started_*.html)는 unpkg 의 **버전 미고정** UMD 를 쓴다. 앱은 이를 따르지 않고 npm 패키지를 번들에 포함한다.

앱 쪽 구현 위치:

| 책임 | 파일 |
| --- | --- |
| SDK 어댑터 (SDK 객체는 여기서만 다룸) | `src/sensors/godirectAdapter.ts` |
| 좁은 SDK 타입, BLE 상수 | `src/sensors/godirectTypes.ts` |
| 장치 연결 상태·측정 시작/정지·단위 변환·플래그·끊김 감시 | `src/sensors/SensorManager.ts` |
| 장치 프로필(범위 스위치·해상도·영점 안내) | `src/sensors/deviceProfiles.ts` |
| 오류 분류 | `src/sensors/errors.ts` |
| 모의 어댑터 (같은 인터페이스) | `src/sensors/mock/MockDeviceAdapter.ts` |
| 측정 기록·구간 통계 | `src/data/recording.ts`, `src/data/stats.ts` |

## 1. BLE 연결을 명시적으로 선택하는 방법

SDK 의 `godirect.selectDevice(bluetooth = true)` 는 다음을 그대로 호출한다 (`src/godirect.js`):

```js
navigator.bluetooth.requestDevice({
  filters: [{ namePrefix: 'GDX' }],
  optionalServices: ['d91714ef-28b9-4f91-ba16-f0d9a604f112'],
});
```

`bluetooth = false` 면 WebHID(`navigator.hid.requestDevice`, vendorId 0x08f7 / productId 0x0010)를 쓴다. 이 앱은 Bluetooth 만 사용한다.

**앱은 `selectDevice()` 를 직접 쓰지 않는다.** 이유: `selectDevice()` 는 내부에서 `createDevice(device)` 를 기본 옵션(`open: true, startMeasurements: true`)으로 부르고, `Device.open(true)` 는 기본 센서를 켜고 즉시 `start()` 를 호출한다. 즉 **SDK 기본 동작은 연결 직후 자동 측정 시작**이다. 앱은 예측 단계 잠금과 본 실험 기록의 시작·정지를 직접 관리해야 하므로

1. 클릭 핸들러에서 첫 `await` 로 `navigator.bluetooth.requestDevice({...})` 를 SDK 와 같은 필터·서비스 UUID 로 직접 호출하고 (`requestGoDirectBluetoothDevice`),
2. `godirect.createDevice(nativeDevice, { open: true, startMeasurements: false })` 로 연결과 채널 조회만 한다.

`createDevice` 와 옵션 `{ open, startMeasurements }` 는 `src/godirect.js` 와 `types/godirect.d.ts` 에 존재한다. 서비스 UUID 와 특성 UUID 는 `src/WebBluetoothDeviceAdapter.js` 에서 가져왔다.

| 항목 | 값 (SDK 소스) |
| --- | --- |
| 서비스 | `d91714ef-28b9-4f91-ba16-f0d9a604f112` |
| 명령 특성 | `f4bf14a6-c7d5-4b6d-8aa8-df1a7c83adcb` |
| 응답 특성 (notify) | `b41e6675-a329-40e0-aa01-44d2f444babe` |
| BLE 쓰기 최대 길이 | 20 바이트 (SDK 가 나눠 보냄) |

사용자 제스처: `requestDevice()` 는 transient activation 이 필요하다. 앱은 연결 버튼의 클릭 핸들러에서 다른 비동기 작업 없이 바로 호출한다 (`SensorPanel.tsx` → `sensorManager.connectBluetooth(role)` → 첫 await 가 `requestDevice`).

## 2. 장치 선택·연결·해제

`Device.open(autoStart)` 순서 (`src/Device.js`):

1. `adapter.setup()` — `gatt.connect()`, 기본 서비스·특성 조회, 응답 특성 `startNotifications()`, 네이티브 장치에 `gattserverdisconnected` 리스너 등록
2. `INIT` → `GET_STATUS` → `GET_INFO`(주문코드·일련번호·이름) → `GET_DEFAULT_SENSORS_MASK` → `GET_SENSOR_IDS` 와 채널별 `GET_SENSOR_INFO`
3. `device-opened` 이벤트 → `autoStart` 면 `start()`

`Device.close()` 는 `_stopMeasurements()` → `DISCONNECT` 명령 → `gatt.disconnect()`. 네이티브 `gattserverdisconnected` 가 `device-closed` 로 올라온다.

주의할 SDK 동작:
- `WebBluetoothDeviceAdapter.setup()` 은 `gatt.connect()` 실패를 `console.error` 로만 남기고, 이어서 `Expected command and response characteristics not found` 를 던진다. 앱은 이 메시지를 **연결 실패(다른 앱이 장치를 사용 중일 가능성 포함)** 로 분류한다 (`classifyOpenError`).
- 모든 명령은 5초 쓰기 타임아웃이 있고 (`_queueWriteCommand`), `start()` 는 동기 함수라 내부 프로미스 거부를 호출자에게 돌려주지 않는다. 앱은 `measurements-started` 이벤트를 6초까지 기다려 시작 실패를 감지한다.
- 장치 식별자: 앱은 `${orderCode}-${serialNumber}` 를 쓰고 (없으면 브라우저 `BluetoothDevice.id`), 같은 식별자가 연결 상태면 중복 등록을 거부한다.
- 재연결: 앱은 선택한 `BluetoothDevice` 객체를 보관하고 `createDevice(native, {...})` 를 다시 호출한다. 선택창 없이 되는지는 **실물 확인 필요**.

## 3. 채널 조회와 활성화

`device.sensors` 는 `Sensor` 배열이다. 각 항목:

| 속성 | 의미 |
| --- | --- |
| `number` | 채널 번호 (장치마다 다름) |
| `name`, `unit` | 장치가 보고한 문자열 (예: 전압 센서 `"Potential - 20 V"`, `"V"`) |
| `enabled`, `value`, `values` | 활성 여부, 최신값, 누적값 배열 |
| `specs.measurementInfo.{minValue,maxValue,uncertainty}` | 센서 단위 기준 범위 |
| `specs.measurementInfo.{minPeriod,typicalPeriod,maxPeriod,granularity}` | **ms** (SDK 가 장치의 µs 값을 1000 으로 나눠 저장) |
| `specs.mutalExclusionMask` | 함께 켤 수 없는 채널 비트마스크 (철자는 SDK 그대로) |

활성화는 `sensor.setEnabled(true|false)`. 활성화 변경은 `state-changed` 를 내고 Device 가 다음을 한다: 상호 배타 채널 끄기, `measurementPeriod` 를 켠 채널의 `typicalPeriod` 로 바꾸기, 측정 중이면 재시작. 따라서 앱은 **측정 중에는 채널을 바꾸지 않고**, 채널을 켠 뒤 `start(period)` 로 주기를 다시 지정한다.

앱의 역할 검증: 역할(전류/전압)에 맞는 채널은 **장치가 보고한 단위 문자열**로 고른다 — `A`/`mA` → 전류, `V`/`mV` → 전압. 전압 센서는 이름에 `20` 이 들어간 채널(설명서의 기본 채널 "Potential - 20 V")을 우선 선택한다. 맞는 채널이 없으면 `wrong_device` 오류와 함께 발견한 채널 목록을 보여 준다.

## 4. 측정 시작·정지

- `device.start(period?)` : 켜진 채널이 없으면 기본 채널을 켠 뒤, `SET_MEASUREMENT_PERIOD` → `START_MEASUREMENTS(채널 마스크)`. 성공 시 `collecting = true`, `measurements-started` 이벤트.
- `device.stop()` : `STOP_MEASUREMENTS`, 성공 시 `measurements-stopped` 이벤트.
- 둘 다 **동기 함수**(내부 프로미스 반환 안 함). 앱은 이벤트로 완료를 확인한다.
- `device.keepValues` 가 기본 `true` 라 `sensor.values` 가 무한히 자란다. 앱은 `false` 로 둔다 (자체 기록 계층이 있음).

## 5. 측정 주기 인자의 단위

`start(period)` 의 `period` 는 **밀리초(ms)** 다. `Device.measurementPeriod` 주석이 `// milliseconds`, `_setMeasurementPeriod(ms * 1000)` 가 µs 로 바꿔 전송한다. `minMeasurementPeriod` 는 10 ms. Hz 가 아니다.

공식 예제 `gdx_getting_started_4.html` 의 `gdxDevice.start(1000)` 도 1초마다 1표본이다.

앱 기본 주기는 100 ms (교사 설정 10~1000 ms). 실제 적용 주기는 `max(요청값, 채널 minPeriod, 장치 minMeasurementPeriod)` 로 올림한 뒤 `device.measurementPeriod` 를 읽어 화면에 표시한다. 장치가 다른 주기로 보정했는지는 **실물 확인 필요**.

## 6. 값 변경 및 연결 해제 이벤트

| 발신자 | 이벤트 | 인자 |
| --- | --- | --- |
| `Sensor` | `value-changed` | `sensor` (최신값 `sensor.value`) |
| `Sensor` | `state-changed` | `sensor` |
| `Device` | `device-opened`, `device-closed` | 없음 |
| `Device` | `measurements-started`, `measurements-stopped` | 없음 |

SDK 는 START_TIME / DROPPED / PERIOD 측정 패킷을 "Purposely Ignoring" 하므로 **표본별 장치 시각을 제공하지 않는다.** 한 BLE 알림에 여러 값(`valueCount`)이 들어오면 같은 시각에 여러 `value-changed` 가 연달아 발생한다. 앱은
- 앱 수신 시각 `tReceived`(`Date.now()`)과 측정 시작 후 순번 `sampleIndex` 를 저장하고,
- 두 센서의 값을 "동기화된 쌍" 으로 다루지 않고, **같은 관찰 구간에서 각 센서가 안정된 값의 평균**을 한 쌍으로 쓴다 (`analyzePairedWindow`).

연결 해제는 네이티브 `gattserverdisconnected` → SDK `device-closed`. 앱은 이를 받아 상태를 `disconnected` 로 바꾸고, 최신값을 지우며(이전 값을 실시간처럼 두지 않음), 열려 있던 기록 구간을 `disconnected` 로 닫는다. 재연결 후에는 새 구간으로 기록하고 끊긴 사이를 보간하지 않는다. 또 측정 중 `max(1.5 s, 5×주기)` 동안 값이 없으면 `no_data_timeout` 으로 표시하고 구간을 `timeout` 으로 닫는다.

## 7. 이벤트 구독 해제

`EventEmitter.off(name, callback)` (`src/utils.js`) — 같은 함수 참조를 넘겨야 하며, 제거 성공 여부를 boolean 으로 돌려준다. `unbind()` 는 모든 리스너를 지운다. 앱 어댑터는 등록한 핸들러 참조를 보관했다가 채널 변경·연결 해제·정리 시 `off` 로 해제한다. React 쪽은 `useSyncExternalStore` 와 ref 가드로 StrictMode 이중 마운트에서도 구독이 하나만 남는다 (`test/recording.test.ts`, `test/sensorManager.test.ts` 에서 검증).

## 8. 장치별 측정 범위와 물리적 범위 스위치

설명서 기준 (https://www.vernier.com/manuals/gdx-cur/, https://www.vernier.com/manuals/gdx-volt/):

### Go Direct Current Probe (GDX-CUR)
- 범위 ±1 A / ±0.1 A — **센서 밑면의 물리 스위치**로 바꾼다. 설명서에 "range setting is not shown in Graphical Analysis" 라고 되어 있고, SDK 에도 범위를 읽거나 바꾸는 명령이 없다. 앱은 사용자가 스위치를 직접 확인해 선택하게 하고(`declaredRange`), 이 값으로 포화·범위 근접을 표시한다. 소프트웨어로 범위를 바꿨다고 표시하지 않는다.
- 해상도 0.031 mA (±1 A), 0.003 mA (±0.1 A). 선형성 0.01 %.
- ±0.1 A 범위에서 100 mA 이상이면 값이 100 mA 바로 위에서 평평해진다(포화).
- 최대 비파괴 전류 1.5 A / 0.5 A, 입력 최대 전압 ±10 V, 입력 임피던스 0.1 Ω (±1 A) / 1 Ω (±0.1 A).
- 회로에 **직렬**로 연결. 빨간 리드 → 검은 리드 방향(상자 화살표)이 양의 전류.
- 영점: 두 리드를 단락한 상태에서 Zero. 오프셋만 조정하고 게인은 바꾸지 않는다.

### Go Direct Voltage Probe (GDX-VOLT)
- 채널 "Potential - 20 V" (기본, 차동 20 V 범위, 16비트 해상도 5 mV), "Potential - 1 V" (작은 신호용). 두 채널이 SDK 에서 어떤 번호와 정확한 이름으로 보고되는지는 **실물 확인 필요**.
- 정확도 ≤ ±1.0 % FS, 최대 1000 표본/s, 입력 임피던스 10 MΩ(대지), 차동 >20 MΩ, 입력 최대 안전 전압 24 V.
- 측정 대상 **양단에 병렬**로 연결. 빨간 클립이 V+, 검은 클립이 V−. 음의 전압도 측정된다 (앱은 절댓값으로 바꾸지 않고 방향 확인을 안내).
- 영점: 두 클립을 단락한 상태에서 Zero.

### 앱의 영점 처리
앱의 "영점 맞추기" 는 **앱 수준 오프셋**이다: 측정 중 약 1.5 초 동안 받은 원래 값의 평균을 오프셋으로 저장하고, 이후 표본에서 뺀다. 보정 전 값(`rawValue`)과 적용 오프셋(`offset`)을 모든 표본·구간·CSV 에 보존한다. SDK 1.8.3 에는 장치 자체 교정을 바꾸는 명령이 없으므로 장치 교정은 건드리지 않으며, 그렇게 표시하지도 않는다.

## 9. 지원 환경 판별

- `window.isSecureContext` 와 `navigator.bluetooth` 존재를 따로 확인한다 (`detectBluetoothCapability`). 둘 다 참이어도 "연결 성공" 이 아니라 "시도 가능" 으로만 표시한다.
- 데스크톱 Chrome·Edge 를 우선 검증 대상으로 둔다. Web Bluetooth 는 Safari·Firefox 에서 지원되지 않는다.
- 미지원 환경에서는 연결 버튼을 비활성화하고 기록 열람·보고서·연습 모드만 제공한다.
- `Permissions-Policy: bluetooth=(self)` 를 `public/_headers` 에 두어 배포 헤더가 같은 출처의 Bluetooth 를 막지 않게 한다.

오류 분류 (`src/sensors/errors.ts`):

| 코드 | 원인 |
| --- | --- |
| `unsupported`, `insecure_context` | API 없음 / HTTPS·localhost 아님 |
| `user_cancelled` | `requestDevice` 가 `NotFoundError` + "cancel/chooser" 메시지 |
| `not_found` | 그 밖의 `NotFoundError` |
| `permission_denied` | `SecurityError`, `NotAllowedError` |
| `connect_failed` (busyPossible) | GATT 연결/특성 조회 실패, 초기화 명령 타임아웃 |
| `wrong_device` | 역할에 맞는 단위의 채널이 없음 |
| `duplicate` | 같은 장치가 이미 연결됨 |
| `start_failed` | `measurements-started` 가 6초 안에 오지 않음 |
| `disconnected_during_measurement` | 측정 중 `device-closed` |
| `no_data_timeout` | 측정 중 일정 시간 값 없음 |

## 10. 실물 장치로 아직 확인하지 못한 항목

아래는 소스·설명서로는 알 수 없어 실제 GDX-CUR / GDX-VOLT 로 확인해야 한다 (`docs/hardware-checklist.md`).

1. GDX-CUR 의 채널 번호·이름·단위 문자열 (단위가 `A` 인지 `mA` 인지에 따라 앱이 자동 변환함)
2. GDX-VOLT 두 채널의 번호·정확한 이름 (`"Potential - 20 V"` 포함 여부로 기본 채널을 고름)
3. `specs.measurementInfo.minValue/maxValue` 가 실제 범위를 보고하는지, 범위 스위치와 무관하게 ±1 A 로 고정인지
4. `start(100)` 요청 시 `device.measurementPeriod` 가 100 으로 유지되는지, 한 BLE 알림에 몇 표본이 묶여 오는지
5. `device-closed` 가 전원 꺼짐·거리 이탈 시 몇 초 안에 오는지
6. 보관한 `BluetoothDevice` 로 `createDevice()` 를 다시 불러 선택창 없이 재연결되는지
7. 두 장치 동시 연결 시 BLE 알림 지연·누락 정도
8. 다른 앱(Graphical Analysis)이 장치를 쥐고 있을 때의 실제 오류 메시지가 `connect_failed` 로 분류되는지
9. 모의 어댑터의 채널 정의(`MockDeviceAdapter.ts`)는 위 1·2 확인 뒤 실물과 맞출 것
