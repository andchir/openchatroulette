import {NgModule} from '@angular/core';
import {HttpClientModule} from '@angular/common/http';
import {BrowserModule} from '@angular/platform-browser';
import {environment} from '../environments/environment';

import {NgxsModule} from '@ngxs/store';
import {NgxsLoggerPluginModule} from '@ngxs/logger-plugin';

import {TablerIconsModule} from 'angular-tabler-icons';
import {IconChevronDown, IconChevronUp, IconHandStop, IconArrowBigLeft} from 'angular-tabler-icons/icons';
const icons = {
    IconChevronDown,
    IconChevronUp,
    IconHandStop,
    IconArrowBigLeft
};

import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {AppState} from './store/states/app.state';

@NgModule({
    declarations: [
        AppComponent
    ],
    imports: [
        BrowserModule,
        AppRoutingModule,
        HttpClientModule,

        NgxsModule.forRoot([AppState], {
            developmentMode: !environment.production
        }),
        NgxsLoggerPluginModule.forRoot({
            disabled: environment.production,
            collapsed: true
        }),
        TablerIconsModule.pick(icons)
    ],
    providers: [],
    bootstrap: [AppComponent]
})
export class AppModule {
}
