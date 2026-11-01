 
const Alerts = {
  successIcon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="1em" height="1em" aria-hidden="true" focusable="false" style="display:block"><path d="m8 16 5.5 5.5L24 11" fill="none" stroke="var(--color-success, #237a56)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  show: function (title, text = "", icon = "info", options = {}) {
    return Swal.fire({
      title: title,
      text: text,
      icon: icon,
      ...(icon === "success" ? { iconHtml: this.successIcon } : {}),
      confirmButtonColor: "#dce7f1",
      ...options
    });
  },

  confirm: function (title, text) {
    return Swal.fire({
      title: title,
      text: text,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Confirm",
      confirmButtonColor: "#dce7f1"
    });
  },

  toast: function (title, icon = "success") {
    return Swal.fire({
      title: title,
      icon: icon,
      toast: true,
      ...(icon === "success" ? { iconHtml: this.successIcon } : {}),
      position: "top-end",
      timer: 2500,
      showConfirmButton: false,
      timerProgressBar: true,
      ...(document.body.classList.contains("admin-notifications") ? {
        showCloseButton: true,
        didOpen: function (popup) {
          popup.addEventListener("mouseenter", Swal.stopTimer);
          popup.addEventListener("mouseleave", Swal.resumeTimer);
          popup.addEventListener("focusin", Swal.stopTimer);
          popup.addEventListener("focusout", Swal.resumeTimer);
        }
      } : {})
    });
  },

   
  form: function (title, html, save, options = {}) {
    return Swal.fire({
      title: title,
      html: html,
      showCancelButton: true,
      confirmButtonText: "Save",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dce7f1",
      focusConfirm: false,
      showLoaderOnConfirm: true,
      allowOutsideClick: function () { return !Swal.isLoading(); },
      allowEscapeKey: function () { return !Swal.isLoading(); },
      ...options,
      preConfirm: save,
      didOpen: function () {
        const input = document.querySelector(".swal2-html-container input:not([disabled]):not([type=hidden])");
        if (input) input.focus();
      }
    });
  },

  validation: function (message) {
    Swal.showValidationMessage(message);
  }
};

