import { fromEvent } from "rxjs";
import {
  switchMap,
  filter,
  map,
  tap,
  distinctUntilChanged
} from "rxjs/operators";
import $ from "jquery";

import "./styles.css";
import { get } from "./http";

const callApi = ({ gender }) => {
  return get(`https://randomuser.me/api/?inc=gender,name,nat&gender=${gender}`);
};

fromEvent($("#form"), "submit")
  .pipe(
    tap(e => e.preventDefault()),
    map(e => ({ gender: $("#gender").val() })),
    filter(Boolean),
    // distinctUntilChanged(),
    switchMap(callApi)
  )
  .subscribe(res => {
    $("#content").html(JSON.stringify(res.body, null, 4));
  });
