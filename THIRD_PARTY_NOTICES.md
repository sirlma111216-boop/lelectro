# 제3자 소프트웨어 고지

이 앱은 아래 오픈소스 소프트웨어를 번들에 포함하거나 빌드에 사용한다. 각 라이선스 전문은 `node_modules/<패키지>/LICENSE` 에 있다.

## 런타임 번들에 포함

| 패키지 | 버전 | 라이선스 | 비고 |
| --- | --- | --- | --- |
| @vernier/godirect | 1.8.3 | BSD-3-Clause | Vernier Software & Technology. Go Direct 센서 통신 SDK. 소스를 수정하지 않고 npm 배포본(`dist/godirect.min.esm.js`)을 그대로 번들에 포함한다. 빌드 시 `text-encoding` 모듈 참조만 빈 대체 모듈(`src/shims/text-encoding.ts`)로 해석한다(브라우저에서는 실행되지 않는 분기). |
| react, react-dom | 19.3.1 | MIT | |
| react-router-dom | 7.18.4 | MIT | |
| uplot | 1.6.32 | MIT | 실시간 시간 그래프 |
| idb | 8.0.4 | ISC | IndexedDB 래퍼 |
| zustand | 5.0.15 | MIT | 상태 관리 |

### @vernier/godirect 라이선스 (BSD 3-Clause)

```
BSD 3-Clause License

Copyright (c) 2019, Vernier Software & Technology
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

* Neither the name of the copyright holder nor the names of its
  contributors may be used to endorse or promote products derived from
  this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

Vernier, Go Direct 는 Vernier Software & Technology 의 상표다. 이 앱은 Vernier 의 공식 제품이나 인증 앱이 아니며, Vernier 의 이름을 홍보에 사용하지 않는다.

## 개발·빌드 도구 (번들에 포함되지 않음)

vite, @vitejs/plugin-react, typescript, vitest, jsdom, fake-indexeddb, @playwright/test, wrangler, @types/* — 각각 MIT 또는 Apache-2.0(일부 @types 는 MIT). 정확한 버전은 `package-lock.json` 참고.

## 참고한 공식 자료

- https://github.com/VernierST/godirect-js (SDK 소스)
- https://github.com/VernierST/godirect-examples , https://vernierst.github.io/godirect-examples/javascript/ (공식 예제)
- https://www.vernier.com/manuals/gdx-cur/ , https://www.vernier.com/manuals/gdx-volt/ (센서 설명서)
- https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API
- https://developers.cloudflare.com/workers/static-assets/ , https://developers.cloudflare.com/workers/ci-cd/builds/
