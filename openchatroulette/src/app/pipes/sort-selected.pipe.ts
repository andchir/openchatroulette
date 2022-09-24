import {Pipe, PipeTransform} from "@angular/core";

@Pipe({
    name: 'sortSelected'
})
export class SortSelectedPipe implements PipeTransform {
    transform(items: any[], key: string, value: string) {
        if (key && value) {
            return [...items.sort((a, b) => {
                if (!a[key] || a[key] === value) {
                    return -1;
                }
                if (a[key] < b[key]) {
                    return -1;
                }
                if (a[key] > b[key]) {
                    return 1;
                }
                return 0;
            })];
        } else {
            return items;
        }
    }
}
