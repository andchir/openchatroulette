import {Pipe, PipeTransform} from "@angular/core";

@Pipe({
    name: 'sortSelected'
})
export class SortSelectedPipe implements PipeTransform {
    transform(items: any[], key: string, value: string) {
        if (key && value) {
            return [...items.sort((a) => {
                return a[key] === value ? -1 : 1;
            })];
        } else {
            return items;
        }
    }
}
