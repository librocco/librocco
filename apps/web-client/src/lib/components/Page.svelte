<div class="flex overflow-hidden">
	<!-- Main content -->
	<div id="content" class="relative flex h-screen w-full flex-col overflow-hidden bg-gray-50">
		<!-- Top bar input -->
		<div
			class="relative flex h-16 w-full flex-shrink-0 items-center bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.6),0px_1px_3px_0px_rgba(0,0,0,0.1)] sm:h-[66px]"
		>
			<!-- Top bar input -->
			<div class="relative flex h-full w-full items-center px-4 focus-within:ring-2 focus-within:ring-inset">
				<slot
					name="topbar"
					iconProps={{ class: "text-gray-400", size: 24 }}
					inputProps={{ class: "w-full border-0 focus:outline-none focus:ring-0" }}
				/>
			</div>
			<!-- Top bar input end -->
		</div>
		<!-- Topbar container end -->

		<!-- Heading section -->
		<header class="w-full px-4 pb-6 pt-5 xs:px-8">
			<slot name="heading" />
		</header>
		<!-- Heading section end -->

		<!-- Main section -->
		<main class="relative flex h-full w-full flex-col justify-between overflow-hidden border-t bg-white">
			<div class="relative h-full w-full overflow-y-auto">
				<slot name="main" />
			</div>

			<div class="flex h-8 items-center justify-end border-t bg-gray-100 px-4">
				<slot name="footer" />
			</div>
		</main>
		<!-- Main section end -->
	</div>
</div>
