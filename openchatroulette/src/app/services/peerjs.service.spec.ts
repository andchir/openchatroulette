import { TestBed } from '@angular/core/testing';

import { PeerjsService } from './peerjs.service';

describe('PeerjsService', () => {
  let service: PeerjsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PeerjsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
