import SwiftUI

struct WeatherSettingsView: View {
    @ObservedObject var companion: CompanionModel
    @StateObject private var model = WeatherSettingsModel()
    var body: some View {
        VStack(spacing: 0) {
            HomeContent {
                HomeSection {
                    Toggle("Show weather on your frame", isOn: $model.draft.enabled).toggleStyle(.switch)
                    Text("Current conditions and a five-day forecast.").font(.caption).foregroundStyle(.secondary)
                }
                HomeSection("Location") {
                    if !model.draft.label.isEmpty {
                        HomeLabel(model.draft.label, icon: "map-pin").font(.headline)
                    }
                    HStack {
                        TextField("Search city or postal code", text: $model.query).textFieldStyle(.roundedBorder)
                            .onSubmit { Task { await model.search() } }
                        Button(model.searching ? "Searching…" : "Search") { Task { await model.search() } }
                            .disabled(model.searching || model.query.trimmingCharacters(in: .whitespacesAndNewlines).count < 2)
                    }
                    if let message = model.searchMessage { Text(message).font(.callout).foregroundStyle(.secondary) }
                    ForEach(model.locations) { location in
                        Button { model.select(location) } label: {
                            HStack { Text(location.title); Spacer(); Text("Choose").foregroundStyle(Color.accentColor) }
                                .padding(10).background(HomeDesign.canvas, in: RoundedRectangle(cornerRadius: 6))
                        }.buttonStyle(.plain)
                    }
                    Text("Search is provided by Open-Meteo.").font(.caption).foregroundStyle(.secondary)
                }
                HomeSection("Display") {
                    HomeSettingRow(title: "Temperature") {
                        Picker("Temperature units", selection: $model.draft.temperatureUnit) {
                            Text("Celsius · °C").tag(WeatherSettings.Unit.celsius)
                            Text("Fahrenheit · °F").tag(WeatherSettings.Unit.fahrenheit)
                        }.pickerStyle(.segmented).labelsHidden().frame(maxWidth: 300)
                    }
                    HomeSettingRow(title: "Frame timezone") { Text(model.draft.timezone).foregroundStyle(.secondary) }
                    Text("The clock, calendar and collection schedule use the same timezone.").font(.caption).foregroundStyle(.secondary)
                    DisclosureGroup("Advanced location settings") {
                        VStack(spacing: 12) {
                            HomeSettingRow(title: "Display name") { TextField("Your location", text: $model.draft.label).textFieldStyle(.roundedBorder) }
                            HomeSettingRow(title: "Timezone") { TextField("IANA timezone", text: $model.draft.timezone).textFieldStyle(.roundedBorder) }
                            HomeSettingRow(title: "Latitude") { TextField("Latitude", value: $model.draft.latitude, format: .number).textFieldStyle(.roundedBorder) }
                            HomeSettingRow(title: "Longitude") { TextField("Longitude", value: $model.draft.longitude, format: .number).textFieldStyle(.roundedBorder) }
                        }.padding(.top, 12)
                    }
                }
                Link("Weather by Open-Meteo · CC BY 4.0", destination: URL(string: "https://open-meteo.com/en/terms")!).font(.caption)
            }.disabled(model.loadFailed)
            HomeFooter {
                Text(model.message ?? model.draft.validationMessage ?? "Changes apply when you save.").font(.caption).foregroundStyle(.secondary)
                Spacer()
                Button("Save Weather") { model.save(folder: companion.output) }
                    .buttonStyle(.borderedProminent).disabled(model.loadFailed || model.draft.validationMessage != nil)
            }
        }
        .onAppear { model.load(folder: companion.output) }
        .onChange(of: companion.output) { _, folder in model.load(folder: folder) }
    }
}
