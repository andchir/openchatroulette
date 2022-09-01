import {Component, HostListener, OnInit} from '@angular/core';

import {PeerjsService} from './services/peerjs.service';

declare const window: Window;

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {

    readonly peerId: string;
    videoHeight = 400;

    constructor(
        peerjsService: PeerjsService
    ) {
        this.peerId = peerjsService.peerInit();
    }

    @HostListener('window:resize', ['$event.target'])
    onResize(window: Window): void {
        const footerHeight = 250;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        if (windowWidth < 992) {
            this.videoHeight = 300;
        } else {
            this.videoHeight = Math.floor(windowHeight - footerHeight);
        }
    }

    ngOnInit(): void {
        this.onResize(window);
    }
}
