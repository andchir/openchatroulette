import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpClientModule} from '@angular/common/http';
import {BrowserModule} from '@angular/platform-browser';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {environment} from '../environments/environment';

import {NgxsModule} from '@ngxs/store';
import {NgxsLoggerPluginModule} from '@ngxs/logger-plugin';
import {BsDropdownModule} from 'ngx-bootstrap/dropdown';

import {TablerIconsModule} from 'angular-tabler-icons';
import {
    IconChevronDown,
    IconChevronUp,
    IconHandStop,
    IconArrowBigLeft,
    IconDeviceComputerCamera,
    IconMicrophone,
    IconMenu2,
    IconVolume,
    IconVolumeOff,
    IconVolume2
} from 'angular-tabler-icons/icons';
const icons = {
    IconChevronDown,
    IconChevronUp,
    IconHandStop,
    IconArrowBigLeft,
    IconDeviceComputerCamera,
    IconMicrophone,
    IconMenu2,
    IconVolume,
    IconVolumeOff,
    IconVolume2
};

import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {AppState} from './store/states/app.state';
import {UserMediaState} from './store/states/user-media.state';
import {FilterArrayPipe, FilterItemsPipe} from './pipes/filter-array.pipe';
import {SortSelectedPipe} from './pipes/sort-selected.pipe';

@NgModule({
    declarations: [
        AppComponent,
        FilterArrayPipe,
        FilterItemsPipe,
        SortSelectedPipe
    ],
    imports: [
        BrowserModule,
        AppRoutingModule,
        HttpClientModule,
        FormsModule,
        BrowserAnimationsModule,

        BsDropdownModule.forRoot(),
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
