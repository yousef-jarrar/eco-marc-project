// جميع رسائل SweetAlert2 في مكان واحد.
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
  }
};
