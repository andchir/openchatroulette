import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {environment} from '../environments/environment';

import {NgxsModule} from '@ngxs/store';
import {NgxsWebsocketPluginModule} from '@ngxs/websocket-plugin';

import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {AppState} from './store/app.state';

@NgModule({
    declarations: [
        AppComponent
    ],
    imports: [
        BrowserModule,
        AppRoutingModule,

        NgxsModule.forRoot([AppState], {
            developmentMode: !environment.production
        }),
        NgxsWebsocketPluginModule.forRoot({
            url: 'ws://localhost:6759'
        })
    ],
    providers: [],
    bootstrap: [AppComponent]
})
export class AppModule {
}
