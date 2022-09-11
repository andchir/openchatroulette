import {Pipe} from '@angular/core';

@Pipe({
    name: 'filter',
    pure: false
})
export class FilterArrayPipe {
    transform(value: any, filter: {[key: string]: string|boolean}, skipEmpty = false): any {
        if (filter && Array.isArray(value)) {
            const filterKeys = Object.keys(filter);
            return value.filter(item =>
                filterKeys.reduce((memo, keyName) => {
                    if (!filter[keyName] && skipEmpty) {
                        return true;
                    }
                    if (typeof filter[keyName] === 'string' && String(filter[keyName]).indexOf('-') === 0) {
                        return memo && item[keyName] !== String(filter[keyName]).replace('-', '');
                    } else {
                        return memo && item[keyName] === filter[keyName];
                    }
                }, true));
        } else {
            return value;
        }
    }
}
