import pkg from '../../package.json';

export const APP_NAME = '전류와 전압 탐구실';
export const APP_VERSION: string = (pkg as { version: string }).version;
