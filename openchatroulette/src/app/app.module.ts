import {NgModule} from '@angular/core';
import {HttpClientModule} from '@angular/common/http';
import {BrowserModule} from '@angular/platform-browser';
import {environment} from '../environments/environment';

import {NgxsModule} from '@ngxs/store';
import {NgxsLoggerPluginModule} from '@ngxs/logger-plugin';

import {TablerIconsModule} from 'angular-tabler-icons';
import {
    IconChevronDown,
    IconChevronUp,
    IconHandStop,
    IconArrowBigLeft,
    IconDeviceComputerCamera,
    IconMicrophone
} from 'angular-tabler-icons/icons';
const icons = {
    IconChevronDown,
    IconChevronUp,
    IconHandStop,
    IconArrowBigLeft,
    IconDeviceComputerCamera,
    IconMicrophone
};

import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {AppState} from './store/states/app.state';
import {UserMediaState} from './store/states/user-media.state';
import {FilterArrayPipe} from './pipes/filter-array.pipe';

@NgModule({
    declarations: [
        AppComponent,
        FilterArrayPipe
    ],
    imports: [
        BrowserModule,
        AppRoutingModule,
        HttpClientModule,

        NgxsModule.forRoot([AppState, UserMediaState], {
            developmentMode: !environment.production
        }),
        NgxsLoggerPluginModule.forRoot({
            disabled: environment.production,
            collapsed: false
        }),
        TablerIconsModule.pick(icons)
    ],
    providers: [],
    bootstrap: [AppComponent]
})
export class AppModule {
}
