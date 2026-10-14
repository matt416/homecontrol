import SwiftUI

struct ReminderSettingsView: View {
    @ObservedObject var companion: CompanionModel
    @StateObject private var model = ReminderSettingsModel()
    private let days = [(1, "Monday"), (2, "Tuesday"), (3, "Wednesday"), (4, "Thursday"), (5, "Friday"), (6, "Saturday"), (0, "Sunday")]
    private let bins = [("recycling", "Recycling", "recycle"), ("trash", "Trash", "trash"), ("green", "Green bin", "leaf"), ("brown", "Brown bags", "bag")]

    var body: some View {
        VStack(spacing: 0) {
            HomeContent {
                HomeSection("Collection schedule") {
                    Toggle("Show collection reminders", isOn: $model.draft.bins.enabled).toggleStyle(.switch)
                    if model.draft.bins.enabled {
                        HomeSettingRow(title: "Collection day") {
                            Picker("Collection day", selection: Binding(get: { model.draft.bins.collectionDay }, set: model.setCollectionDay)) {
                                ForEach(days, id: \.0) { day in Text(day.1).tag(day.0) }
                            }.labelsHidden()
                        }
                        HomeSettingRow(title: "First collection date") {
                            DatePicker("First collection date", selection: Binding(get: { ReminderSettings.date(model.draft.bins.anchorDate) ?? Date() }, set: model.setAnchorDate), displayedComponents: .date).labelsHidden()
                        }
                        HomeSettingRow(title: "Repeats every") {
                            Picker("Repeats every", selection: Binding(get: { model.draft.bins.weeks.count }, set: model.setWeekCount)) {
                            ForEach(1...8, id: \.self) { count in Text("\(count) \(count == 1 ? "week" : "weeks")").tag(count) }
                            }.labelsHidden()
                        }
                        ForEach(model.draft.bins.weeks.indices, id: \.self) { index in
                            VStack(alignment: .leading, spacing: 10) {
                                Text(weekTitle(index)).font(.headline)
                                HStack(spacing: 18) {
                                    ForEach(bins, id: \.0) { bin in
                                        Toggle(isOn: Binding(get: { model.draft.bins.weeks[index].contains(bin.0) }, set: { selected in
                                            if selected { model.draft.bins.weeks[index].append(bin.0) }
                                            else { model.draft.bins.weeks[index].removeAll { $0 == bin.0 } }
                                        })) { HomeLabel(bin.1, icon: bin.2) }.toggleStyle(.checkbox)
                                    }
                                }
                            }.padding(.vertical, 5)
                        }
                    } else {
                        Text("Turn this on to choose your collection day and bins.").font(.callout).foregroundStyle(.secondary)
                    }
                    Text("Your frame shows the next collection throughout the week. The schedule repeats from the Week 1 date.").font(.caption).foregroundStyle(.secondary)
                }
            }.disabled(model.loadFailed || companion.output == nil)
            HomeFooter {
                Text(model.message ?? "Changes apply when you save.").font(.caption).foregroundStyle(.secondary)
                Spacer()
                Button("Save Schedule") { model.save(folder: companion.output) }.buttonStyle(.borderedProminent).keyboardShortcut(.defaultAction).disabled(model.loadFailed || companion.output == nil)
            }
        }
        .onAppear { model.load(folder: companion.output) }
        .onChange(of: companion.output) { _, folder in model.load(folder: folder) }
    }
    private func weekTitle(_ index: Int) -> String {
        guard let start = ReminderSettings.date(model.draft.bins.anchorDate), let date = Calendar(identifier: .gregorian).date(byAdding: .day, value: index * 7, to: start) else { return "Week \(index + 1)" }
        return "Week \(index + 1) · \(date.formatted(.dateTime.month(.abbreviated).day()))"
    }
}
