import {Component, OnDestroy, OnInit} from '@angular/core';
import {WebSocketService} from "../../web-socket/web-socket.service";
import {map, Subscription} from "rxjs";
import {MessageDto} from "../dto/message.dto";
import {ActivatedRoute, Router} from "@angular/router";
import {SecurityService} from "../../core/service/security.service";
import {RxStompState} from "@stomp/rx-stomp";
import {NotificationService} from "../../core/service/notification.service";

@Component({
  selector: 'checkpoint-message',
  templateUrl: './message.component.html',
  styleUrls: ['./message.component.scss']
})
export class MessageComponent implements OnInit, OnDestroy {
  private readonly TOPIC_ENDPOINT = '/topic/checkpoint/';
  private readonly MESSAGE_DESTINATION = '/app/checkpoint/';
  receivedMessages: MessageDto[] = [];
  private topicSubscription: Subscription;
  message: string;
  chatRoomUuid: string;
  connected = false;

  constructor(private webSocketService: WebSocketService,
              private securityService: SecurityService,
              private notificationService: NotificationService,
              private router: Router,
              private route: ActivatedRoute) {
  }

  ngOnInit(): void {
    if (!this.securityService.isAuthenticated()) {
      this.notificationService.errorTranslate('notification.missingAuthentication');
      this.router.navigate(['/']);
    }
    this.route.paramMap.subscribe(params => {
      this.chatRoomUuid = params.get('uuid');
      this.initPage();
    });
  }

  private initPage(): void {
    this.topicSubscription = this.webSocketService
      .watch({destination: this.TOPIC_ENDPOINT + this.chatRoomUuid})
      .pipe(map(message => JSON.parse(message.body)))
      .subscribe((message: MessageDto) => this.handleReceivedMessage(message));
    this.webSocketService.activate();
    this.webSocketService.connectionState$.subscribe((state: RxStompState) => this.connected = state === RxStompState.OPEN);
    this.webSocketService.stompErrors$.subscribe(() => this.handleStompError());
  }

  private handleReceivedMessage(message: MessageDto) {
    this.receivedMessages.push(message);
  }

  private handleStompError() {
    this.securityService.removeAuthentication();
    this.notificationService.errorTranslate('notification.stompFailed');
    this.router.navigate(['/']);
  }

  ngOnDestroy(): void {
    if (this.topicSubscription) {
      this.topicSubscription.unsubscribe();
    }
    if (this.webSocketService.active) {
      this.webSocketService.deactivate();
    }
    this.securityService.removeAuthentication();
  }

  sendMessage(): void {
    this.webSocketService.publish({destination: this.MESSAGE_DESTINATION + this.chatRoomUuid, body: this.message});
  }
}
