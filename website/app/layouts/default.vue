<template>
  <div class="site-shell">
    <a class="skip-link" href="#main">Перейти к содержимому</a>
    <SiteHeader />
    <main id="main"><slot /></main>
    <SiteFooter />
  </div>
</template>
