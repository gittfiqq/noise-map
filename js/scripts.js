/*!
* Start Bootstrap - Business Casual v7.0.9
* https://startbootstrap.com/theme/business-casual
* Copyright 2013-2023 Start Bootstrap
* Licensed under MIT
*/

window.addEventListener('DOMContentLoaded', event => {

    const listHoursArray =
        document.body.querySelectorAll('.list-hours li');

    if (listHoursArray.length > 0) {
        listHoursArray[0].classList.add('today');
    }

});
