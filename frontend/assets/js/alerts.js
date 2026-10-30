 
const Alerts = {
  show: function (title, text = "", icon = "info") {
    return Swal.fire({
      title: title,
      text: text,
      icon: icon,
      confirmButtonColor: "#171717"
    });
  },

  confirm: function (title, text) {
    return Swal.fire({
      title: title,
      text: text,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Confirm",
      confirmButtonColor: "#171717"
    });
  },

  toast: function (title, icon = "success") {
    return Swal.fire({
      title: title,
      icon: icon,
      toast: true,
      position: "top-end",
      timer: 2500,
      showConfirmButton: false,
      timerProgressBar: true
    });
  },

   
  form: function (title, html, save, options = {}) {
    return Swal.fire({
      title: title,
      html: html,
      showCancelButton: true,
      confirmButtonText: "Save",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#171717",
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
