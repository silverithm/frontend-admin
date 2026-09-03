// G5a: 앱 답장이 모델·전송·화면 세 곳에 다 있는지.
// 모델만 있고 화면이 없으면 답장을 달 수 없고, 화면만 있고 전송이 없으면 서버에 안 간다.
import { APP, read, want, done } from './_lib.mjs';

const model = read(`${APP}/lib/models/chat_message.dart`);
want(/replyTo/.test(model), '앱 모델에 replyTo가 없다');
want(/replyTo[\s\S]{0,200}?fromJson|fromJson[\s\S]{0,600}?replyTo/.test(model),
     '앱 모델이 서버가 준 replyTo를 파싱하지 않는다');

const api = read(`${APP}/lib/services/api_service.dart`);
want(/replyToId/.test(api), '앱이 답장 대상을 서버로 보내지 않는다');

const screen = read(`${APP}/lib/screens/chat_room_screen.dart`);
want(/replyTo/.test(screen), '앱 화면에 답장 처리가 없다');
want(/답장/.test(screen), '앱 화면에 답장 메뉴가 없다');

done('app-reply-ok');
